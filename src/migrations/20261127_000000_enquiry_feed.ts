import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/* Enquiries sent from a partner website's embedded form record the partner's feed (enquiries.feed → api_feeds). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "enquiries" ADD COLUMN IF NOT EXISTS "feed_id" integer;
    DO $$ BEGIN
      ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_feed_id_api_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."api_feeds"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "enquiries_feed_idx" ON "enquiries" USING btree ("feed_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "enquiries" DROP CONSTRAINT IF EXISTS "enquiries_feed_id_api_feeds_id_fk";
    DROP INDEX IF EXISTS "enquiries_feed_idx";
    ALTER TABLE "enquiries" DROP COLUMN IF EXISTS "feed_id";
  `);
}
