import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "membership_status" varchar DEFAULT 'pending';
    CREATE TABLE IF NOT EXISTS "membership_payments" (
      "id" serial PRIMARY KEY NOT NULL,
      "reference" varchar NOT NULL,
      "member_id" integer REFERENCES "members"("id") ON DELETE SET NULL,
      "subscriber_name" varchar NOT NULL,
      "subscriber_email" varchar NOT NULL,
      "plan" varchar NOT NULL,
      "plan_name" varchar NOT NULL,
      "amount" numeric NOT NULL,
      "currency" varchar DEFAULT 'AED' NOT NULL,
      "status" varchar NOT NULL,
      "transaction_date" timestamp(3) with time zone NOT NULL,
      "recorded_by" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "membership_payments_reference_idx" ON "membership_payments" USING btree ("reference");
    CREATE INDEX IF NOT EXISTS "membership_payments_member_idx" ON "membership_payments" USING btree ("member_id");
    CREATE INDEX IF NOT EXISTS "membership_payments_updated_at_idx" ON "membership_payments" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "membership_payments_created_at_idx" ON "membership_payments" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "membership_payments_id" integer REFERENCES "membership_payments"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_membership_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("membership_payments_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "membership_payments_id";
    DROP TABLE IF EXISTS "membership_payments";
    ALTER TABLE "members" DROP COLUMN IF EXISTS "membership_status";
  `);
}
