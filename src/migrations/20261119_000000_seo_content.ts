import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/* SEO content agent output (src/collections/SeoContent.ts). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_seo_content_kind" AS ENUM('property', 'broker');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_seo_content_status" AS ENUM('draft', 'approved', 'rejected', 'failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE TABLE IF NOT EXISTS "seo_content" (
      "id" serial PRIMARY KEY NOT NULL,
      "path" varchar NOT NULL,
      "kind" "enum_seo_content_kind" NOT NULL,
      "status" "enum_seo_content_status" DEFAULT 'draft' NOT NULL,
      "title" varchar,
      "meta_description" varchar,
      "faq" jsonb,
      "issues" jsonb,
      "source_hash" varchar,
      "model" varchar,
      "generated_at" timestamp(3) with time zone,
      "error" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "seo_content_path_idx" ON "seo_content" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "seo_content_status_idx" ON "seo_content" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "seo_content_updated_at_idx" ON "seo_content" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "seo_content_created_at_idx" ON "seo_content" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "seo_content_id" integer REFERENCES "seo_content"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_seo_content_id_idx" ON "payload_locked_documents_rels" USING btree ("seo_content_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "seo_content_id";
    DROP TABLE IF EXISTS "seo_content";
    DROP TYPE IF EXISTS "public"."enum_seo_content_status";
    DROP TYPE IF EXISTS "public"."enum_seo_content_kind";
  `);
}
