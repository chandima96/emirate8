import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "ai_credits" numeric;
    UPDATE "plans" SET "ai_credits" = CASE "slug"
      WHEN 'broker-bronze' THEN 1000 WHEN 'broker-silver' THEN 3000 WHEN 'broker-gold' THEN 8000
      WHEN 'agency-bronze' THEN 3000 WHEN 'agency-silver' THEN 8000 WHEN 'agency-gold' THEN 25000
      WHEN 'developer-bronze' THEN 3000 WHEN 'developer-silver' THEN 8000 WHEN 'developer-gold' THEN 25000
      ELSE "ai_credits" END
    WHERE "ai_credits" IS NULL;
    CREATE TABLE IF NOT EXISTS "ai_usage" (
      "id" serial PRIMARY KEY NOT NULL,
      "member_id" integer REFERENCES "members"("id") ON DELETE SET NULL,
      "pool_id" integer REFERENCES "members"("id") ON DELETE SET NULL,
      "feature" varchar NOT NULL,
      "model" varchar,
      "input_tokens" numeric DEFAULT 0,
      "output_tokens" numeric DEFAULT 0,
      "cache_creation_tokens" numeric DEFAULT 0,
      "cache_read_tokens" numeric DEFAULT 0,
      "web_fetch_requests" numeric DEFAULT 0,
      "credits" numeric DEFAULT 0 NOT NULL,
      "status" varchar DEFAULT 'ok',
      "request_id" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "ai_usage_member_idx" ON "ai_usage" USING btree ("member_id");
    CREATE INDEX IF NOT EXISTS "ai_usage_pool_idx" ON "ai_usage" USING btree ("pool_id");
    CREATE INDEX IF NOT EXISTS "ai_usage_updated_at_idx" ON "ai_usage" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "ai_usage_id" integer REFERENCES "ai_usage"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_ai_usage_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_usage_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "ai_usage_id";
    DROP TABLE IF EXISTS "ai_usage";
    ALTER TABLE "plans" DROP COLUMN IF EXISTS "ai_credits";
  `);
}
