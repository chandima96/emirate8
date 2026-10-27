import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_members_account_type" ADD VALUE IF NOT EXISTS 'developer';
    DO $$ BEGIN
      CREATE TYPE "public"."enum_properties_owner_type" AS ENUM ('developer', 'agency', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_properties_claim_policy" AS ENUM ('developer_approval');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_property_broker_claims_status" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_developer_subscriptions_status" AS ENUM ('active', 'paused', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_notifications_type" AS ENUM ('developer_property_published', 'developer_property_updated', 'claim_request', 'claim_decision', 'primary_broker_assigned', 'subscription', 'general');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_notifications_delivery" AS ENUM ('in_app', 'queued', 'sent', 'failed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_amenity_definitions_input_type" AS ENUM ('boolean', 'text', 'number', 'select', 'multi_select');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_agency_invitations_role" AS ENUM ('agency_manager', 'agency_broker', 'agency_viewer');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_agency_invitations_status" AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "primary_broker_id" integer;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "owner_type" "public"."enum_properties_owner_type" DEFAULT 'developer';
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "owner_developer_id" integer;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "owner_agency_id" integer;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "owner_direct" boolean DEFAULT false;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "claimable" boolean DEFAULT false;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "claim_policy" "public"."enum_properties_claim_policy" DEFAULT 'developer_approval';
    UPDATE "properties" SET "primary_broker_id" = "broker_id" WHERE "primary_broker_id" IS NULL AND "broker_id" IS NOT NULL;
    UPDATE "properties" SET "owner_type" = 'other' WHERE "owner_developer_id" IS NULL AND "owner_agency_id" IS NULL;
    ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "role_audience" varchar;

    CREATE TABLE IF NOT EXISTS "property_broker_claims" (
      "id" serial PRIMARY KEY NOT NULL,
      "property_id" integer NOT NULL,
      "developer_id" integer NOT NULL,
      "broker_member_id" integer NOT NULL,
      "broker_id" integer,
      "status" "public"."enum_property_broker_claims_status" DEFAULT 'pending' NOT NULL,
      "message" varchar,
      "decision_reason" varchar,
      "reviewed_by_id" integer,
      "reviewed_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "developer_subscriptions" (
      "id" serial PRIMARY KEY NOT NULL,
      "developer_id" integer NOT NULL,
      "broker_id" integer NOT NULL,
      "status" "public"."enum_developer_subscriptions_status" DEFAULT 'active' NOT NULL,
      "notify_new_listings" boolean DEFAULT true,
      "notify_updates" boolean DEFAULT true,
      "frequency" varchar DEFAULT 'immediate',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" serial PRIMARY KEY NOT NULL,
      "recipient_id" integer NOT NULL,
      "type" "public"."enum_notifications_type" NOT NULL,
      "title" varchar NOT NULL,
      "message" varchar,
      "property_id" integer,
      "developer_id" integer,
      "claim_id" integer,
      "read" boolean DEFAULT false,
      "delivery" "public"."enum_notifications_delivery" DEFAULT 'in_app',
      "delivery_error" varchar,
      "event_key" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "amenity_definitions" (
      "id" serial PRIMARY KEY NOT NULL,
      "category" varchar NOT NULL,
      "key" varchar NOT NULL,
      "label" varchar NOT NULL,
      "input_type" "public"."enum_amenity_definitions_input_type" DEFAULT 'boolean',
      "options" jsonb,
      "active" boolean DEFAULT true,
      "searchable" boolean DEFAULT false,
      "public" boolean DEFAULT true,
      "sort_order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "agency_invitations" (
      "id" serial PRIMARY KEY NOT NULL,
      "agency_id" integer NOT NULL,
      "invited_by_id" integer NOT NULL,
      "email" varchar NOT NULL,
      "name" varchar,
      "role" "public"."enum_agency_invitations_role" DEFAULT 'agency_broker',
      "status" "public"."enum_agency_invitations_status" DEFAULT 'pending',
      "token" varchar NOT NULL,
      "expires_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "properties" ADD CONSTRAINT "properties_primary_broker_id_brokers_id_fk" FOREIGN KEY ("primary_broker_id") REFERENCES "public"."brokers"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_developer_id_members_id_fk" FOREIGN KEY ("owner_developer_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_agency_id_agencies_id_fk" FOREIGN KEY ("owner_agency_id") REFERENCES "public"."agencies"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE "property_broker_claims" DROP CONSTRAINT IF EXISTS "property_broker_claims_property_id_properties_id_fk";
    ALTER TABLE "property_broker_claims" ADD CONSTRAINT "property_broker_claims_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "property_broker_claims" ADD CONSTRAINT "property_broker_claims_developer_id_members_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "property_broker_claims" ADD CONSTRAINT "property_broker_claims_broker_member_id_members_id_fk" FOREIGN KEY ("broker_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "property_broker_claims" ADD CONSTRAINT "property_broker_claims_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "developer_subscriptions" ADD CONSTRAINT "developer_subscriptions_developer_id_members_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "developer_subscriptions" ADD CONSTRAINT "developer_subscriptions_broker_id_members_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_members_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_developer_id_members_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_claim_id_property_broker_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."property_broker_claims"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_invited_by_id_members_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "properties_primary_broker_idx" ON "properties" USING btree ("primary_broker_id");
    CREATE INDEX IF NOT EXISTS "properties_owner_developer_idx" ON "properties" USING btree ("owner_developer_id");
    CREATE INDEX IF NOT EXISTS "properties_owner_agency_idx" ON "properties" USING btree ("owner_agency_id");
    CREATE INDEX IF NOT EXISTS "property_broker_claims_property_idx" ON "property_broker_claims" USING btree ("property_id");
    CREATE INDEX IF NOT EXISTS "property_broker_claims_developer_idx" ON "property_broker_claims" USING btree ("developer_id");
    CREATE INDEX IF NOT EXISTS "property_broker_claims_broker_member_idx" ON "property_broker_claims" USING btree ("broker_member_id");
    CREATE INDEX IF NOT EXISTS "developer_subscriptions_developer_idx" ON "developer_subscriptions" USING btree ("developer_id");
    CREATE INDEX IF NOT EXISTS "developer_subscriptions_broker_idx" ON "developer_subscriptions" USING btree ("broker_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "developer_subscriptions_pair_idx" ON "developer_subscriptions" USING btree ("developer_id", "broker_id");
    CREATE INDEX IF NOT EXISTS "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");
    CREATE INDEX IF NOT EXISTS "notifications_event_key_idx" ON "notifications" USING btree ("event_key");
    CREATE INDEX IF NOT EXISTS "amenity_definitions_category_idx" ON "amenity_definitions" USING btree ("category");
    CREATE UNIQUE INDEX IF NOT EXISTS "agency_invitations_token_idx" ON "agency_invitations" USING btree ("token");
    CREATE INDEX IF NOT EXISTS "agency_invitations_agency_idx" ON "agency_invitations" USING btree ("agency_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "agency_invitations" CASCADE;
    DROP TABLE IF EXISTS "amenity_definitions" CASCADE;
    DROP TABLE IF EXISTS "notifications" CASCADE;
    DROP TABLE IF EXISTS "developer_subscriptions" CASCADE;
    DROP TABLE IF EXISTS "property_broker_claims" CASCADE;
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "claim_policy";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "claimable";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "owner_direct";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "owner_agency_id";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "owner_developer_id";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "owner_type";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "primary_broker_id";
    ALTER TABLE "plans" DROP COLUMN IF EXISTS "role_audience";
    DROP TYPE IF EXISTS "public"."enum_agency_invitations_status";
    DROP TYPE IF EXISTS "public"."enum_agency_invitations_role";
    DROP TYPE IF EXISTS "public"."enum_amenity_definitions_input_type";
    DROP TYPE IF EXISTS "public"."enum_notifications_delivery";
    DROP TYPE IF EXISTS "public"."enum_notifications_type";
    DROP TYPE IF EXISTS "public"."enum_developer_subscriptions_status";
    DROP TYPE IF EXISTS "public"."enum_property_broker_claims_status";
    DROP TYPE IF EXISTS "public"."enum_properties_claim_policy";
    DROP TYPE IF EXISTS "public"."enum_properties_owner_type";
  `);
}
