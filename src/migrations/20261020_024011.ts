import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_members_account_type" AS ENUM('broker', 'agency', 'buyer', 'owner');
  CREATE TYPE "public"."enum_members_credential_status" AS ENUM('pending', 'verified', 'rejected');
  CREATE TABLE "members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"account_type" "enum_members_account_type" NOT NULL,
  	"mobile" varchar,
  	"profile" jsonb,
  	"credential_status" "enum_members_credential_status" DEFAULT 'pending',
  	"plan" varchar DEFAULT 'starter',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "member_state" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"state" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "properties" ADD COLUMN "app_data" jsonb;
  ALTER TABLE "brokers" ADD COLUMN "app_data" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "members_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_state_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "members_id" integer;
  ALTER TABLE "member_state" ADD CONSTRAINT "member_state_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "members_updated_at_idx" ON "members" USING btree ("updated_at");
  CREATE INDEX "members_created_at_idx" ON "members" USING btree ("created_at");
  CREATE UNIQUE INDEX "members_email_idx" ON "members" USING btree ("email");
  CREATE INDEX "member_state_member_idx" ON "member_state" USING btree ("member_id");
  CREATE INDEX "member_state_key_idx" ON "member_state" USING btree ("key");
  CREATE INDEX "member_state_updated_at_idx" ON "member_state" USING btree ("updated_at");
  CREATE INDEX "member_state_created_at_idx" ON "member_state" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_state_fk" FOREIGN KEY ("member_state_id") REFERENCES "public"."member_state"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_members_id_idx" ON "payload_locked_documents_rels" USING btree ("members_id");
  CREATE INDEX "payload_locked_documents_rels_member_state_id_idx" ON "payload_locked_documents_rels" USING btree ("member_state_id");
  CREATE INDEX "payload_preferences_rels_members_id_idx" ON "payload_preferences_rels" USING btree ("members_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_state" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "members" CASCADE;
  DROP TABLE "member_state" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_members_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_member_state_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_members_fk";
  
  DROP INDEX "payload_locked_documents_rels_members_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_state_id_idx";
  DROP INDEX "payload_preferences_rels_members_id_idx";
  ALTER TABLE "properties" DROP COLUMN "app_data";
  ALTER TABLE "brokers" DROP COLUMN "app_data";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "members_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_state_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "members_id";
  DROP TYPE "public"."enum_members_account_type";
  DROP TYPE "public"."enum_members_credential_status";`)
}
