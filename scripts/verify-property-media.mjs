import 'dotenv/config';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const base = 'http://localhost:3000';
const publicBase = process.env.S3_PUBLIC_URL.replace(/\/+$/, '') + '/';
const response = await fetch(`${base}/api/app-public`);
assert.equal(response.status, 200);
const data = await response.json();
const refs = [...new Set(data.listings.flatMap(listing => [listing.featured, ...(listing.images || [])]).filter(Boolean))];
for (const src of refs) assert.ok(src.startsWith(publicBase), `Property image still uses a local path: ${src}`);
await Promise.all(refs.map(async src => {
  const image = await fetch(src);
  assert.equal(image.status, 200, src);
  await sharp(Buffer.from(await image.arrayBuffer())).metadata();
}));
const legacy = await fetch(`${base}/api/media-assets/dubai-marina.webp`, { redirect: 'manual' });
assert.equal(legacy.status, 307);
assert.ok(legacy.headers.get('location').startsWith(publicBase));
const media = await (await fetch(`${base}/api/media?limit=1000&depth=0`)).json();
const bundled = media.docs.filter(doc => doc.sourcePath && !doc.sourcePath.startsWith('uploads/'));
for (const doc of bundled) assert.ok(doc.url.startsWith(publicBase), `Admin image still uses a local path: ${doc.filename}`);
console.log(`Verified ${refs.length} uploaded property images across ${data.listings.length} public listings, ${bundled.length} admin media URLs, and legacy image redirects.`);
