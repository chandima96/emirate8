import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/*
 * Replace the single primary broker with up to five brokers per property (src/collections/Properties.ts `brokers`).
 * Payload stores a hasMany relationship in `properties_rels` (path = 'brokers'). Each property's current broker
 * (primary_broker_id, falling back to the legacy broker_id) becomes its first broker, then both columns are dropped.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "properties_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
      "path" varchar NOT NULL,
      "brokers_id" integer REFERENCES "brokers"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "properties_rels_order_idx" ON "properties_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "properties_rels_parent_idx" ON "properties_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "properties_rels_path_idx" ON "properties_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "properties_rels_brokers_id_idx" ON "properties_rels" USING btree ("brokers_id");

    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'primary_broker_id') THEN
        INSERT INTO "properties_rels" ("order", "parent_id", "path", "brokers_id")
        SELECT 1, p."id", 'brokers', COALESCE(p."primary_broker_id", p."broker_id")
        FROM "properties" p
        WHERE COALESCE(p."primary_broker_id", p."broker_id") IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "properties_rels" r WHERE r."parent_id" = p."id" AND r."path" = 'brokers');
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'broker_id') THEN
        INSERT INTO "properties_rels" ("order", "parent_id", "path", "brokers_id")
        SELECT 1, p."id", 'brokers', p."broker_id"
        FROM "properties" p
        WHERE p."broker_id" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "properties_rels" r WHERE r."parent_id" = p."id" AND r."path" = 'brokers');
      END IF;
    END $$;

    ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_primary_broker_id_brokers_id_fk";
    ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_broker_id_brokers_id_fk";
    DROP INDEX IF EXISTS "properties_primary_broker_idx";
    DROP INDEX IF EXISTS "properties_broker_idx";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "primary_broker_id";
    ALTER TABLE "properties" DROP COLUMN IF EXISTS "broker_id";

    -- Workspace JSON kept a copy of the old single field; move it into the new list too.
    UPDATE "properties"
    SET "app_data" = (("app_data" - 'primaryBroker') - 'broker') || jsonb_build_object(
      'brokers',
      CASE WHEN COALESCE("app_data"->>'primaryBroker', '') <> '' THEN jsonb_build_array("app_data"->'primaryBroker') ELSE '[]'::jsonb END
    )
    WHERE "app_data" IS NOT NULL AND jsonb_typeof("app_data") = 'object' AND "app_data" ? 'primaryBroker'
      AND NOT ("app_data" ? 'brokers');

    DO $$ BEGIN
      ALTER TYPE "public"."enum_notifications_type" RENAME VALUE 'primary_broker_assigned' TO 'broker_assigned';
    EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "broker_id" integer REFERENCES "brokers"("id") ON DELETE SET NULL;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "primary_broker_id" integer REFERENCES "brokers"("id") ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS "properties_broker_idx" ON "properties" USING btree ("broker_id");
    CREATE INDEX IF NOT EXISTS "properties_primary_broker_idx" ON "properties" USING btree ("primary_broker_id");
    UPDATE "properties" p
    SET "primary_broker_id" = r."brokers_id", "broker_id" = r."brokers_id"
    FROM (
      SELECT DISTINCT ON ("parent_id") "parent_id", "brokers_id"
      FROM "properties_rels" WHERE "path" = 'brokers' ORDER BY "parent_id", "order"
    ) r
    WHERE r."parent_id" = p."id";
    DROP TABLE IF EXISTS "properties_rels";
    DO $$ BEGIN
      ALTER TYPE "public"."enum_notifications_type" RENAME VALUE 'broker_assigned' TO 'primary_broker_assigned';
    EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;
  `);
}
