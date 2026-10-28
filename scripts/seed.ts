/**
 * seed.ts — Create the initial admin user and sample data.
 *
 * Usage:
 *   npm run seed
 *
 * Prerequisites:
 *   - .env must be populated
 *   - npm run migrate must have been run first
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { getPayload } from 'payload';
import configPromise from '../payload.config';
import { BROKERS } from '../src/config/seed-data/brokers';
import { PLAN_CATALOG } from '../src/config/plans';
import { NETWORK_SRC } from '../src/config/seed-data/listings';
import { normalize } from '../src/lib/normalizeListing';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || '';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || '';

// Public directory profiles for recognizable UAE developers. These are seed
// records for the demo directory, not affiliated accounts or verified claims.
const REAL_WORLD_DEVELOPERS = [
  { slug: 'emaar-properties', name: 'Emaar Properties', website: 'https://www.emaar.com', location: 'Dubai, UAE', description: 'UAE property developer with residential, commercial, retail and hospitality communities.' },
  { slug: 'damac-properties', name: 'DAMAC Properties', website: 'https://www.damacproperties.com', location: 'Dubai, UAE', description: 'Dubai-based developer known for residential, branded and master-planned communities.' },
  { slug: 'nakheel', name: 'Nakheel', website: 'https://www.nakheel.com', location: 'Dubai, UAE', description: 'Dubai master developer behind large-scale waterfront and urban communities.' },
  { slug: 'aldar-properties', name: 'Aldar Properties', website: 'https://www.aldar.com', location: 'Abu Dhabi, UAE', description: 'Abu Dhabi property developer and manager with communities across the UAE and beyond.' },
  { slug: 'sobha-realty', name: 'Sobha Realty', website: 'https://www.sobharealty.com', location: 'Dubai, UAE', description: 'Luxury real estate developer with residential communities in Dubai and the region.' },
  { slug: 'meraas', name: 'Meraas', website: 'https://meraas.com', location: 'Dubai, UAE', description: 'Dubai developer creating lifestyle-led destinations, residential communities and attractions.' },
  { slug: 'binghatti-developers', name: 'Binghatti Developers', website: 'https://www.binghatti.com', location: 'Dubai, UAE', description: 'Dubai developer focused on residential and mixed-use developments.' },
  { slug: 'danube-properties', name: 'Danube Properties', website: 'https://danubeproperties.com', location: 'Dubai, UAE', description: 'Dubai residential developer offering apartment communities and structured payment plans.' },
];

async function imageFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return imageFiles(entryPath);
      return entry.isFile() && /\.webp$/i.test(entry.name) ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

async function seed() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL)) {
    throw new Error('Set SEED_ADMIN_EMAIL to a valid address in .env before running the seed script.');
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error('Set SEED_ADMIN_PASSWORD to a password of at least 12 characters in .env.');
  }
  if (
    !process.env.S3_BUCKET ||
    !process.env.S3_ENDPOINT ||
    !process.env.S3_PUBLIC_URL ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error('Configure the Supabase Storage S3 variables in .env before importing media.');
  }

  const config = await configPromise;
  const payload = await getPayload({ config });

  // ── 1. Admin user ────────────────────────────────────────────────────────
  console.log('🌱 Seeding admin user…');
  const existingAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: ADMIN_EMAIL } },
    limit: 1,
    overrideAccess: true,
  });
  if (existingAdmin.docs.length) {
    if (existingAdmin.docs[0]?.role !== 'admin') {
      throw new Error('SEED_ADMIN_EMAIL is already assigned to a non-admin Payload user. Use an admin account email.');
    }
    console.log('   ℹ️  Admin already exists; keeping its current account and password.');
  } else {
    try {
      await payload.create({
        collection: 'users',
        data: {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          name: 'Admin',
          role: 'admin',
        },
      });
      console.log('   ✅ Admin created from SEED_ADMIN_EMAIL.');
    } catch (err: unknown) {
      if (err instanceof Error && /already registered|duplicate|unique/i.test(err.message)) {
        console.log('   ℹ️  Admin already exists; keeping its current account and password.');
      } else {
        throw err;
      }
    }
  }

  // ── 2. Plans ─────────────────────────────────────────────────────────────
  console.log('🌱 Seeding plans…');
  const plans = Object.values(PLAN_CATALOG).map(({ id, ...plan }) => ({
    ...plan,
    slug: id,
    features: plan.features.map((feature) => ({ feature })),
  }));

  for (const plan of plans) {
    const existingPlan = await payload.find({ collection: 'plans', where: { slug: { equals: plan.slug } }, limit: 1, overrideAccess: true });
    if (existingPlan.docs[0]) {
      await payload.update({ collection: 'plans', id: existingPlan.docs[0].id, data: plan as any, overrideAccess: true });
    } else {
      await payload.create({ collection: 'plans', data: plan as any, overrideAccess: true });
    }
    console.log(`   Plan: ${plan.name} (${plan.roleAudience})`);
  }
  await payload.delete({ collection: 'plans', where: { slug: { in: ['starter', 'team', 'enterprise', 'developer'] } }, overrideAccess: true });

  console.log('Seeding amenity definitions...');
  console.log('\n🌱 Seeding public UAE developer directory profiles…');
  for (const developer of REAL_WORLD_DEVELOPERS) {
    const email = `seed.developer.${developer.slug}@emirate08.local`;
    const existing = await payload.find({
      collection: 'members',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    });
    if (existing.docs[0]) {
      console.log(`   ℹ️  Developer already exists: ${developer.name}`);
      continue;
    }
    await payload.create({
      collection: 'members',
      overrideAccess: true,
      data: {
        email,
        password: randomUUID(),
        name: developer.name,
        mobile: '',
        accountType: 'developer',
        credentialStatus: 'pending',
        plan: 'developer',
        adminCreated: false,
        adminAccess: false,
        profile: {
          legalName: developer.name,
          credentials: { seededDirectoryProfile: true },
          developer: { ...developer, public: true },
          trial: false,
          notifications: { enquiries: true, network: true, selection: true, billing: true, product: false },
          privacy: { showPhone: false, showEmail: false, showWhatsapp: false, showBrn: false },
          prefs: { language: 'English', currency: 'AED', contact: 'email' },
        },
      } as any,
    });
    console.log(`   ✅ Developer: ${developer.name}`);
  }

  const amenities = [
    ['residential', 'balcony', 'Balcony'],
    ['residential', 'maid-room', 'Maid room'],
    ['residential', 'furnished', 'Furnished'],
    ['villa', 'private-pool', 'Private pool'],
    ['villa', 'private-garden', 'Private garden'],
    ['commercial', 'fitted', 'Fitted'],
    ['commercial', 'shell-and-core', 'Shell and core'],
    ['commercial', 'parking-ratio', 'Parking ratio'],
    ['offplan', 'payment-plan', 'Payment plan'],
    ['offplan', 'escrow', 'Escrow registered'],
  ];
  for (const [category, key, label] of amenities) {
    try {
      await payload.create({ collection: 'amenity-definitions', data: { category, key, label, inputType: 'boolean', active: true, public: true } as any });
    } catch {
      // Seed is intentionally repeatable.
    }
  }

  // Import every bundled WebP asset into Supabase Storage through Payload Media.
  console.log('\n🌱 Importing image assets into Supabase Storage…');
  const imageDirectory = path.resolve(process.cwd(), 'public/images');
  const mediaIDs = new Map<string, string | number>();
  for (const filePath of await imageFiles(imageDirectory)) {
    const sourcePath = path.relative(imageDirectory, filePath).split(path.sep).join('/');
    const existing = await payload.find({
      collection: 'media',
      where: { sourcePath: { equals: sourcePath } },
      limit: 1,
      overrideAccess: true,
    });
    const document = existing.docs[0]
      ? existing.docs[0]
      : await payload.create({
          collection: 'media',
          data: {
            sourcePath,
            alt: path.basename(sourcePath, path.extname(sourcePath)).replace(/[-_]/g, ' '),
          },
          filePath,
          overrideAccess: true,
        });
    mediaIDs.set(sourcePath, document.id);
  }
  const mediaID = (source: unknown) => {
    if (typeof source !== 'string') return undefined;
    const sourcePath = source.replace(/^\/?images\//, '');
    return mediaIDs.get(sourcePath);
  };

  // Public demo inventory lives in the database too; the frontend reads it from Payload.
  console.log('\nðŸŒ± Seeding public broker and property records...');
  const brokerIDs = new Map<string, string | number>();
  for (const [key, broker] of Object.entries(BROKERS) as [string, any][]) {
    const found = await payload.find({
      collection: 'brokers',
      where: { slug: { equals: broker.slug } },
      limit: 1,
      overrideAccess: true,
    });
    const data = {
      name: broker.name,
      slug: broker.slug,
      title: broker.title,
      bio: broker.bio,
      phone: broker.phone,
      whatsapp: broker.whatsapp,
      email: broker.email,
      verified: Boolean(broker.brnVerified),
      featured: Boolean(broker.featured),
      photo: mediaID(broker.photo),
      appData: { ...broker, id: broker.id || key },
    };
    const doc = found.docs[0]
      ? await payload.update({ collection: 'brokers', id: found.docs[0].id, data, overrideAccess: true })
      : await payload.create({ collection: 'brokers', data, overrideAccess: true });
    brokerIDs.set(key, doc.id);
  }

  for (const source of NETWORK_SRC as any[]) {
    const listing = normalize({ ...source });
    const broker = (BROKERS as any)[listing.brokerId];
    const found = await payload.find({
      collection: 'properties',
      where: { slug: { equals: listing.slug } },
      limit: 1,
      overrideAccess: true,
    });
    const data = {
      title: listing.title || listing.name || listing.slug,
      slug: listing.slug,
      ref: listing.ref || listing.id,
      status: listing.status || 'published',
      purpose: listing.purpose || 'sale',
      category: listing.category || 'residential',
      type: listing.type || 'Apartment',
      completion: listing.completion || 'ready',
      emirate: listing.emirate || 'Dubai',
      area: listing.area || 'Dubai',
      community: listing.community || '',
      price: Number(listing.price) || 0,
      priceOnRequest: Boolean(listing.priceOnRequest),
      size: Number(listing.size) || undefined,
      beds: Number(listing.beds) || 0,
      baths: Number(listing.baths) || 0,
      description: listing.description || '',
      broker: brokerIDs.get(listing.brokerId),
      featuredImage: mediaID(listing.featured),
      photos: (listing.photos || [])
        .map((photo: any) => ({ image: mediaID(photo.src), caption: photo.caption || '' }))
        .filter((photo: any) => photo.image),
      appData: { ...listing, broker: broker || null },
    };
    if (found.docs[0]) {
      await payload.update({ collection: 'properties', id: found.docs[0].id, data: data as any, overrideAccess: true });
    } else {
      await payload.create({ collection: 'properties', data: data as any, overrideAccess: true });
    }
  }

  // ── 3. Done ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete.');
  console.log('   Visit http://localhost:3000/admin to log in.\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
