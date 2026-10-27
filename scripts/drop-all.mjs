/**
 * drop-all.mjs
 * Drops ALL tables and enums in the public schema — use before a clean migration.
 * Run: node scripts/drop-all.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URI,
  ssl: { rejectUnauthorized: false },
});

async function dropAll() {
  const client = await pool.connect();
  try {
    console.log('⚠️  Dropping all tables and enums in public schema...');

    // Drop all tables
    await client.query(`
      DO $$ 
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('  ✅ All tables dropped');

    // Drop all enums
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) LOOP
          EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('  ✅ All enums dropped');

    console.log('\n✅ Database cleared. Run "npm run migrate" to apply fresh schema.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

dropAll().catch((err) => {
  console.error('❌ Drop failed:', err.message);
  process.exit(1);
});
