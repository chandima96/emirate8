import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "membership" jsonb;
    WITH resolved AS (
      SELECT id, CASE
        WHEN plan LIKE account_type::text || '-%' THEN plan
        WHEN account_type::text = 'agency' AND plan = 'team' THEN 'agency-silver'
        WHEN account_type::text = 'agency' AND plan = 'enterprise' THEN 'agency-gold'
        ELSE account_type::text || '-bronze' END AS slug
      FROM members WHERE account_type::text IN ('broker', 'agency', 'developer')
    )
    UPDATE members m SET membership = jsonb_build_object(
      'plan', r.slug, 'name', COALESCE(p.name, initcap(split_part(r.slug, '-', 2))),
      'price', p.price, 'currency', 'AED', 'interval', 'month', 'agreedAt', m.created_at
    ) FROM resolved r LEFT JOIN plans p ON p.slug = r.slug
    WHERE m.id = r.id AND m.membership IS NULL;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "members" DROP COLUMN IF EXISTS "membership";`);
}
