import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "members"
      ADD COLUMN "admin_created" boolean DEFAULT false,
      ADD COLUMN "admin_access" boolean DEFAULT false;
    CREATE INDEX "members_admin_access_idx" ON "members" USING btree ("admin_access");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "members_admin_access_idx";
    ALTER TABLE "members"
      DROP COLUMN "admin_created",
      DROP COLUMN "admin_access";
  `)
}
