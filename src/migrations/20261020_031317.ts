import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "source_path" varchar;
  CREATE UNIQUE INDEX "media_source_path_idx" ON "media" USING btree ("source_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_source_path_idx";
  ALTER TABLE "media" DROP COLUMN "source_path";`)
}
