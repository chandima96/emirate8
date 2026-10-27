import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'subadmin';
    ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'verifier';
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false;
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // PostgreSQL enum values cannot be removed safely without rebuilding the type.
}
