import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
    ALTER TABLE "members"
      ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
    ALTER TABLE "media"
      ADD COLUMN IF NOT EXISTS "_objectkey" varchar;

    CREATE TABLE IF NOT EXISTS "users_sessions" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "created_at" timestamp(3) with time zone,
      "expires_at" timestamp(3) with time zone NOT NULL,
      CONSTRAINT "users_sessions_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
    );
    CREATE TABLE IF NOT EXISTS "members_sessions" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "created_at" timestamp(3) with time zone,
      "expires_at" timestamp(3) with time zone NOT NULL,
      CONSTRAINT "members_sessions_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action
    );
    CREATE TABLE IF NOT EXISTS "payload_kv" (
      "id" serial PRIMARY KEY NOT NULL,
      "key" varchar NOT NULL,
      "data" jsonb NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "members_sessions_order_idx" ON "members_sessions" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "members_sessions_parent_id_idx" ON "members_sessions" USING btree ("_parent_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "payload_kv_key_idx" ON "payload_kv" USING btree ("key");

    ALTER TABLE "users_sessions" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "members_sessions" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "payload_kv" DISABLE ROW LEVEL SECURITY;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "users_sessions" CASCADE;
    DROP TABLE IF EXISTS "members_sessions" CASCADE;
    DROP TABLE IF EXISTS "payload_kv" CASCADE;
    ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_requested_at";
    ALTER TABLE "members" DROP COLUMN IF EXISTS "reset_password_requested_at";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "_objectkey";
  `)
}
