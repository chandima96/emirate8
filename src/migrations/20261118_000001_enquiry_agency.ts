import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "enquiries" ADD COLUMN IF NOT EXISTS "agency_id" integer;
    ALTER TABLE "enquiries" ADD COLUMN IF NOT EXISTS "agency_name" varchar;
    DO $$ BEGIN
      ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "enquiries_agency_idx" ON "enquiries" USING btree ("agency_id");

    -- Backfill: enquiries already sent to brokers who currently belong to an agency.
    UPDATE "enquiries" AS e
    SET "agency_id" = a."id", "agency_name" = a."name"
    FROM "members" AS m, "agencies" AS a
    WHERE e."broker_member_id" = m."id"
      AND e."agency_id" IS NULL
      AND a."id"::text = COALESCE(m."profile"->'agency'->>'agencyId', m."profile"->>'agencyId');
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "enquiries" DROP CONSTRAINT IF EXISTS "enquiries_agency_id_agencies_id_fk";
    DROP INDEX IF EXISTS "enquiries_agency_idx";
    ALTER TABLE "enquiries" DROP COLUMN IF EXISTS "agency_id";
    ALTER TABLE "enquiries" DROP COLUMN IF EXISTS "agency_name";
  `);
}
