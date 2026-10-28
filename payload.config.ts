import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { s3Storage } from '@payloadcms/storage-s3';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

import { Users } from './src/collections/Users';
import { Members } from './src/collections/Members';
import { MemberState } from './src/collections/MemberState';
import { Media } from './src/collections/Media';
import { Properties } from './src/collections/Properties';
import { Brokers } from './src/collections/Brokers';
import { Agencies } from './src/collections/Agencies';
import { Plans } from './src/collections/Plans';
import { Enquiries } from './src/collections/Enquiries';
import { WaitlistSignups } from './src/collections/WaitlistSignups';
import { PropertyBrokerClaims } from './src/collections/PropertyBrokerClaims';
import { DeveloperSubscriptions } from './src/collections/DeveloperSubscriptions';
import { Notifications } from './src/collections/Notifications';
import { AmenityDefinitions } from './src/collections/AmenityDefinitions';
import { AgencyInvitations } from './src/collections/AgencyInvitations';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — Emirate08 Admin',
      icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/icon.svg' }],
    },
  },

  collections: [
    Users,
    Members,
    MemberState,
    Media,
    Properties,
    Brokers,
    Agencies,
    Plans,
    Enquiries,
    WaitlistSignups,
    PropertyBrokerClaims,
    DeveloperSubscriptions,
    Notifications,
    AmenityDefinitions,
    AgencyInvitations,
  ],

  // ── PostgreSQL on Supabase ─────────────────────────────────
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      // Vercel can run many warm function instances, each with its own pool.
      // Start small for Supabase poolers; raise only if per-instance queries queue.
      max: process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : 1,
      ssl:
        process.env.DATABASE_SSL === 'false'
          ? false
          : process.env.DATABASE_URI && !process.env.DATABASE_URI.includes('localhost')
            ? { rejectUnauthorized: false }
            : false,
    },
  }),

  // ── Supabase S3-compatible Storage ────────────────────────
  plugins: [
    ...(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID
      ? [
          s3Storage({
            collections: {
              media: {
                // Map bucket key → public CDN URL
                generateFileURL: ({ filename: fname, prefix }: { filename?: string; prefix?: string }) =>
                  `${process.env.S3_PUBLIC_URL?.replace(/\/+$/, '')}/${[prefix, fname].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/')}`,
              },
            },
            bucket: process.env.S3_BUCKET || 'media',
            config: {
              region: process.env.S3_REGION || 'ap-south-1',
              endpoint: process.env.S3_ENDPOINT,
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
              },
              forcePathStyle: true,
            },
          }),
        ]
      : []),
  ],

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  sharp,

  graphQL: {
    schemaOutputFile: path.resolve(dirname, 'payload-schema.graphql'),
  },
});
