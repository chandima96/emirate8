import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { postgresAdapter, type PostgresAdapter } from '@payloadcms/db-postgres';
import { getPayload } from 'payload';
import configPromise from '../payload.config';

async function imageFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? imageFiles(file) : /\.(webp|jpg|jpeg|png|avif)$/i.test(file) ? [file] : [];
  }))).flat();
}

async function main() {
  for (const key of ['DATABASE_URI', 'S3_BUCKET', 'S3_REGION', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL']) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
  const config = await configPromise;
  // A media import must never push development schema changes.
  config.db = { ...postgresAdapter({
    push: false,
    pool: {
      max: 3,
      connectionTimeoutMillis: 15000,
      connectionString: process.env.DATABASE_URI,
      ssl: process.env.DATABASE_SSL === 'false' || process.env.DATABASE_URI.includes('localhost') ? false : { rejectUnauthorized: false },
    },
  }), allowIDOnCreate: false, name: 'postgres' };
  const payload = await getPayload({ config });
  const s3 = new S3Client({
    region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT, forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  });
  try {
    const root = path.resolve('public/images');
    const media = await payload.find({ collection: 'media', limit: 10000, depth: 0, overrideAccess: true });
    const mappings = new Map<string, { id: number; url: string }>();
    let uploaded = 0;
    async function syncFile(filePath: string) {
      const sourcePath = path.relative(root, filePath).split(path.sep).join('/');
      let doc = media.docs.find(doc => doc.sourcePath === sourcePath);
      const bytes = await readFile(filePath);
      if (doc) {
        const key = [(doc as typeof doc & { prefix?: string }).prefix, doc.filename].filter(Boolean).join('/');
        let exists = false;
        try {
          const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
          if (head.ContentLength !== bytes.length) throw new Error(`Stored file differs from bundled image: ${sourcePath}`);
          exists = true;
        } catch (error) {
          if (error.$metadata?.httpStatusCode !== 404) throw error;
        }
        if (!exists) {
          const contentType = doc.mimeType || 'image/webp';
          await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: bytes, ContentType: contentType }));
          uploaded++;
        }
      } else {
        doc = await payload.create({ collection: 'media', data: { sourcePath, alt: path.basename(sourcePath, path.extname(sourcePath)).replace(/[-_]/g, ' ') }, filePath, overrideAccess: true });
        uploaded++;
      }
      const key = [(doc as typeof doc & { prefix?: string }).prefix, doc.filename].filter(Boolean).join('/');
      const url = `${process.env.S3_PUBLIC_URL.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
        throw new Error(`Public image check failed for ${sourcePath}: HTTP ${response.status}. Check the bucket is public.`);
      }
      if (Buffer.compare(Buffer.from(await response.arrayBuffer()), bytes) !== 0) throw new Error(`Public file content differs: ${sourcePath}`);
      const value = { id: doc.id, url };
      for (const alias of [`/images/${sourcePath}`, `/api/media-assets/${sourcePath}`, url]) mappings.set(alias, value);
      console.log(`Verified: ${sourcePath}`);
    }
    const queue = await imageFiles(root);
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) await syncFile(queue.shift()!);
    }));

    function replaceURLs(value: any): any {
      if (typeof value === 'string') return mappings.get(value)?.url || value;
      if (Array.isArray(value)) return value.map(replaceURLs);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceURLs(child)]));
      return value;
    }
    function listingMedia(listing: any) {
      const result = replaceURLs(listing);
      if (Array.isArray(result?.photos)) result.photos = result.photos.map(photo => ({ ...photo, ...(mappings.has(photo.src) ? { mediaId: mappings.get(photo.src).id } : {}) }));
      return result;
    }
    const properties = await payload.find({ collection: 'properties', limit: 10000, depth: 0, overrideAccess: true });
    let linked = 0;
    for (const property of properties.docs) {
      if (!property.appData || typeof property.appData !== 'object') continue;
      const listing: any = listingMedia(property.appData);
      const data: any = { appData: listing };
      const featured = mappings.get(listing.featured);
      if (featured) data.featuredImage = featured.id;
      const photos = (listing.photos || []).map(photo => ({ image: mappings.get(photo.src)?.id, caption: photo.caption || '' }));
      if (photos.length && photos.every(photo => photo.image)) data.photos = photos;
      if (JSON.stringify(property.appData) !== JSON.stringify(listing) || (featured && featured.id !== property.featuredImage)) {
        await payload.update({ collection: 'properties', id: property.id, data, overrideAccess: true });
        linked++;
        console.log(`Linked property: ${property.id}`);
      }
    }
    // Keep saved workspace listings consistent so a later save retains the uploaded URLs.
    const states = await payload.find({ collection: 'member-state', limit: 10000, depth: 0, overrideAccess: true });
    let updatedStates = 0;
    for (const state of states.docs) {
      const value: any = state.state;
      if (!Array.isArray(value?.listings)) continue;
      const next = { ...value, listings: value.listings.map(listingMedia) };
      if (JSON.stringify(value) !== JSON.stringify(next)) {
        await payload.update({ collection: 'member-state', id: state.id, data: { state: next }, overrideAccess: true });
        updatedStates++;
      }
    }
    console.log(`Complete: ${uploaded} files uploaded; ${mappings.size / 3} public images verified; ${linked} properties and ${updatedStates} workspaces updated.`);
  } finally {
    s3.destroy();
    await (payload.db as PostgresAdapter).pool.end();
    await payload.destroy();
  }
}

main().catch(error => {
  console.error(error.cause?.message || error.message);
  process.exit(1);
});
