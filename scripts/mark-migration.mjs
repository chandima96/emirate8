/**
 * mark-migration.mjs
 * Marks the initial migration as already applied in the payload_migrations table.
 * Run this once when Payload dev mode already pushed the schema.
 */
import pg from 'pg';
import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const { Pool } = pg;
const dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URI,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  // Find all migration files
  const migDir = path.resolve(dirname, '../src/migrations');
  let files;
  try {
    files = await readdir(migDir);
  } catch {
    console.error('No migrations directory found.');
    process.exit(1);
  }

  const tsFiles = files.filter(f => f.endsWith('.ts') && !f.includes('index'));
  
  for (const file of tsFiles) {
    const name = file.replace('.ts', '');
    console.log(`Marking migration as applied: ${name}`);
    
    try {
      // Create the table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "payload_migrations" (
          "id" serial PRIMARY KEY NOT NULL,
          "name" varchar,
          "batch" numeric,
          "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
      `);
      
      // Check if already exists
      const existing = await pool.query(
        'SELECT id FROM payload_migrations WHERE name = $1',
        [name]
      );
      
      if (existing.rows.length > 0) {
        console.log(`  ℹ️  Already marked: ${name}`);
      } else {
        await pool.query(
          'INSERT INTO payload_migrations (name, batch) VALUES ($1, $2)',
          [name, 1]
        );
        console.log(`  ✅ Marked: ${name}`);
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
    }
  }

  await pool.end();
  console.log('\nDone. Run "npm run seed" next.');
}

run().catch(console.error);
