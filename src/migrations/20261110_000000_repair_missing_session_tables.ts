import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Restores Payload's session tables if they were removed after the original
 * schema migration was recorded. Existing parent records are left untouched.
 */
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

    CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "members_sessions_order_idx" ON "members_sessions" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "members_sessions_parent_id_idx" ON "members_sessions" USING btree ("_parent_id");

    ALTER TABLE "users_sessions" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "members_sessions" DISABLE ROW LEVEL SECURITY;
  `)
}

/** This repair is intentionally forward-only to prevent accidental data loss. */
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This repair migration is forward-only; do not drop the restored session tables.')
}
