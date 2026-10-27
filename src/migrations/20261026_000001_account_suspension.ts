import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_suspended" boolean DEFAULT false;
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "is_suspended" boolean DEFAULT false;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "is_suspended";
    ALTER TABLE "members" DROP COLUMN IF EXISTS "is_suspended";
  `);
}
