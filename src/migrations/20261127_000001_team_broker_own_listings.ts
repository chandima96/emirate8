import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/*
 * A team broker's own listings belong to the broker, not to their agency (src/app/api/app-state/route.ts).
 * Listings that team brokers created earlier were saved as agency-owned; this hands them back:
 * - agency ownership is cleared and the broker becomes the listing's only broker (as for independents);
 * - enquiries keep their agency only when they are about a listing that agency owns.
 * Not reversible: the down migration does not restore agency ownership.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "team_broker_listings";
    CREATE TEMP TABLE "team_broker_listings" AS
      SELECT p."id" AS "property_id",
        -- The broker's own profile row (one per member; the oldest if duplicates exist).
        (SELECT b."id" FROM "brokers" AS b WHERE b."app_data"->>'ownerMemberId' = m."id"::text ORDER BY b."id" LIMIT 1) AS "broker_row_id"
      FROM "properties" AS p
      JOIN "members" AS m ON m."id"::text = p."app_data"->>'ownerMemberId'
      WHERE p."owner_agency_id" IS NOT NULL
        AND m."profile"->'agency'->>'agencyRole' = 'agency_broker';

    UPDATE "properties" AS p
    SET "owner_agency_id" = NULL,
        "owner_type" = 'other',
        "app_data" = (p."app_data" - 'ownerAgency') || jsonb_build_object('ownerType', 'other')
    WHERE p."id" IN (SELECT "property_id" FROM "team_broker_listings");

    -- The owner is the listing's only broker, like an independent broker's listing.
    DELETE FROM "properties_rels" AS r
    USING "team_broker_listings" AS t
    WHERE r."parent_id" = t."property_id" AND r."path" = 'brokers'
      AND r."brokers_id" IS DISTINCT FROM t."broker_row_id";

    INSERT INTO "properties_rels" ("order", "parent_id", "path", "brokers_id")
    SELECT 1, t."property_id", 'brokers', t."broker_row_id"
    FROM "team_broker_listings" AS t
    WHERE t."broker_row_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "properties_rels" AS r
        WHERE r."parent_id" = t."property_id" AND r."path" = 'brokers' AND r."brokers_id" = t."broker_row_id"
      );

    UPDATE "properties" AS p
    SET "app_data" = p."app_data" || jsonb_build_object(
      'brokers',
      CASE WHEN t."broker_row_id" IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(t."broker_row_id"::text) END
    )
    FROM "team_broker_listings" AS t
    WHERE p."id" = t."property_id";

    -- Agency inboxes only show enquiries about listings the agency owns.
    UPDATE "enquiries" AS e
    SET "agency_id" = NULL, "agency_name" = NULL
    WHERE e."agency_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "properties" AS p
        WHERE p."owner_agency_id" = e."agency_id"
          AND (p."app_data"->>'id' = e."property_ref" OR p."id"::text = e."property_ref")
      );

    DROP TABLE IF EXISTS "team_broker_listings";
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Ownership handed back to brokers is not restored.
}
