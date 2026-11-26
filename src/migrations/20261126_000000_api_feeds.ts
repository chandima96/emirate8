import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/* Property feed API keys and selections (src/collections/ApiFeeds.ts). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "api_feeds" (
      "id" serial PRIMARY KEY NOT NULL,
      "member_id" integer NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
      "key_hash" varchar,
      "key_prefix" varchar,
      "key_created_at" timestamp(3) with time zone,
      "last_used_at" timestamp(3) with time zone,
      "request_count" numeric DEFAULT 0,
      "auto_include_new" boolean DEFAULT true,
      "excluded" jsonb,
      "included" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "api_feeds_member_idx" ON "api_feeds" USING btree ("member_id");
    CREATE INDEX IF NOT EXISTS "api_feeds_key_hash_idx" ON "api_feeds" USING btree ("key_hash");
    CREATE INDEX IF NOT EXISTS "api_feeds_updated_at_idx" ON "api_feeds" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "api_feeds_created_at_idx" ON "api_feeds" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "api_feeds_id" integer REFERENCES "api_feeds"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_api_feeds_id_idx" ON "payload_locked_documents_rels" USING btree ("api_feeds_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "api_feeds_id";
    DROP TABLE IF EXISTS "api_feeds";
  `);
}
