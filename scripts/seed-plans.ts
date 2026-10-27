import 'dotenv/config';
import { getPayload } from 'payload';
import configPromise from '../payload.config';
import { PLAN_CATALOG } from '../src/config/plans';

const legacyPlanByRole: Record<string, Record<string, string>> = {
  broker: { starter: 'broker-bronze' },
  agency: { team: 'agency-silver', enterprise: 'agency-gold' },
  developer: { developer: 'developer-bronze' },
};

async function seedPlans() {
  const config: any = await configPromise;
  config.db.push = false;
  const payload = await getPayload({ config });
  for (const plan of Object.values(PLAN_CATALOG)) {
    const { id, ...fields } = plan;
    const data = { ...fields, slug: id, features: plan.features.map((feature) => ({ feature })) } as any;
    const found = await payload.find({ collection: 'plans', where: { slug: { equals: plan.id } }, limit: 1, overrideAccess: true });
    if (found.docs[0]) await payload.update({ collection: 'plans', id: found.docs[0].id, data, overrideAccess: true });
    else await payload.create({ collection: 'plans', data, overrideAccess: true });
  }

  const members = await payload.find({ collection: 'members', limit: 10000, pagination: false, overrideAccess: true });
  for (const member of members.docs as any[]) {
    const mappedPlan = legacyPlanByRole[member.accountType]?.[member.plan];
    if (mappedPlan) await payload.update({ collection: 'members', id: member.id, data: { plan: mappedPlan }, overrideAccess: true });
  }

  await payload.delete({ collection: 'plans', where: { slug: { in: ['starter', 'team', 'enterprise', 'developer'] } }, overrideAccess: true });
  console.log('Seeded nine Bronze, Silver, and Gold plans and migrated existing member plan IDs.');
  process.exit(0);
}

seedPlans().catch((error) => {
  console.error('Plan seeding failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
