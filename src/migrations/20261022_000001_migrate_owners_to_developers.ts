import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/** Runs after the enum migration has committed, because PostgreSQL cannot use a newly added enum value in the same transaction. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "members" SET "account_type" = 'developer' WHERE "account_type" = 'owner';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "members" SET "account_type" = 'owner' WHERE "account_type" = 'developer';
  `);
}
