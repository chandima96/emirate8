import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "public"."enum_properties_category" ADD VALUE IF NOT EXISTS 'land';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Hotel apartment';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Residential building';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Shop / Retail';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Showroom';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Commercial villa';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Commercial building';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Factory';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Labour accommodation';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Residential plot';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Commercial plot';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Industrial plot';
    ALTER TYPE "public"."enum_properties_type" ADD VALUE IF NOT EXISTS 'Mixed-use plot';
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Additive enum values are retained so existing property records remain valid.
}
