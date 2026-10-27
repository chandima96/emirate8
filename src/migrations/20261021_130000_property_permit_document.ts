import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "permit_document_id" integer;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'properties_permit_document_id_media_id_fk'
      ) THEN
        ALTER TABLE "properties"
          ADD CONSTRAINT "properties_permit_document_id_media_id_fk"
          FOREIGN KEY ("permit_document_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS "properties_permit_document_idx"
      ON "properties" USING btree ("permit_document_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "properties_permit_document_idx";
    ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_permit_document_id_media_id_fk";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "permit_document_id";
  `);
}
