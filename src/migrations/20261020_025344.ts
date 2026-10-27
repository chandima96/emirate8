import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_enquiries_kind" AS ENUM('message', 'viewing');
  ALTER TYPE "public"."enum_enquiries_status" ADD VALUE 'replied' BEFORE 'closed';
  ALTER TABLE "enquiries" ADD COLUMN "property_ref" varchar;
  ALTER TABLE "enquiries" ADD COLUMN "property_title" varchar;
  ALTER TABLE "enquiries" ADD COLUMN "broker_ref" varchar;
  ALTER TABLE "enquiries" ADD COLUMN "kind" "enum_enquiries_kind";
  ALTER TABLE "enquiries" ADD COLUMN "preferred_date" varchar;
  ALTER TABLE "enquiries" ADD COLUMN "broker_member_id" integer;
  ALTER TABLE "enquiries" ADD COLUMN "from_member_id" integer;
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_broker_member_id_members_id_fk" FOREIGN KEY ("broker_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_from_member_id_members_id_fk" FOREIGN KEY ("from_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "enquiries_broker_member_idx" ON "enquiries" USING btree ("broker_member_id");
  CREATE INDEX "enquiries_from_member_idx" ON "enquiries" USING btree ("from_member_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "enquiries" DROP CONSTRAINT "enquiries_broker_member_id_members_id_fk";
  
  ALTER TABLE "enquiries" DROP CONSTRAINT "enquiries_from_member_id_members_id_fk";
  
  ALTER TABLE "enquiries" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "enquiries" ALTER COLUMN "status" SET DEFAULT 'new'::text;
  DROP TYPE "public"."enum_enquiries_status";
  CREATE TYPE "public"."enum_enquiries_status" AS ENUM('new', 'in_progress', 'closed');
  ALTER TABLE "enquiries" ALTER COLUMN "status" SET DEFAULT 'new'::"public"."enum_enquiries_status";
  ALTER TABLE "enquiries" ALTER COLUMN "status" SET DATA TYPE "public"."enum_enquiries_status" USING "status"::"public"."enum_enquiries_status";
  DROP INDEX "enquiries_broker_member_idx";
  DROP INDEX "enquiries_from_member_idx";
  ALTER TABLE "enquiries" DROP COLUMN "property_ref";
  ALTER TABLE "enquiries" DROP COLUMN "property_title";
  ALTER TABLE "enquiries" DROP COLUMN "broker_ref";
  ALTER TABLE "enquiries" DROP COLUMN "kind";
  ALTER TABLE "enquiries" DROP COLUMN "preferred_date";
  ALTER TABLE "enquiries" DROP COLUMN "broker_member_id";
  ALTER TABLE "enquiries" DROP COLUMN "from_member_id";
  DROP TYPE "public"."enum_enquiries_kind";`)
}
