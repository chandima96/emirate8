import 'server-only';
import { NextResponse } from 'next/server';
import { PLAN_CATALOG, planIdForAudience } from '@/config/plans';
import { MAX_PROPERTY_BROKERS, brokerIdsOf } from '@/lib/propertyBrokers';
import type { MemberContext } from '../memberContext';
import { memberRole } from './member';

export async function createDeveloperProperty({ payload, member }: MemberContext, body: Record<string, any>) {
  if (memberRole(member) !== 'developer') return NextResponse.json({ error: 'Only developers can create developer properties.' }, { status: 403 });
  if (!body.title || !body.area || !body.type || !body.purpose || !body.price) return NextResponse.json({ error: 'Title, area, type, purpose and price are required.' }, { status: 400 });
  const requestedBrokers = brokerIdsOf({ brokers: Array.isArray(body.brokers) ? body.brokers : [] });
  if (Array.isArray(body.brokers) && new Set(body.brokers.map(String)).size > MAX_PROPERTY_BROKERS) return NextResponse.json({ error: `Choose at most ${MAX_PROPERTY_BROKERS} brokers.` }, { status: 400 });
  if (!body.ownerDirect && !requestedBrokers.length) return NextResponse.json({ error: 'Select at least one broker or choose owner-direct publishing.' }, { status: 400 });
  const owned = await payload.find({ collection: 'properties', where: { ownerDeveloper: { equals: member.id } }, limit: 1, pagination: false, overrideAccess: true });
  const developerPlanId = planIdForAudience(member.plan, 'developer');
  const propertyLimit = PLAN_CATALOG[developerPlanId].listings;
  if (propertyLimit != null && owned.totalDocs >= propertyLimit) return NextResponse.json({ error: `Your Developer ${PLAN_CATALOG[developerPlanId].name} plan has reached its ${propertyLimit}-property limit.` }, { status: 403 });
  if (requestedBrokers.length) {
    const found = await payload.find({ collection: 'brokers', where: { id: { in: requestedBrokers } }, limit: requestedBrokers.length, depth: 0, overrideAccess: true });
    if (found.docs.length !== requestedBrokers.length) return NextResponse.json({ error: 'One of the selected brokers was not found.' }, { status: 400 });
  }
  const slug = String(body.slug || body.title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  const property = await payload.create({
    collection: 'properties',
    data: {
      title: body.title,
      slug,
      purpose: body.purpose,
      category: body.category || 'residential',
      type: body.type,
      completion: body.completion || 'ready',
      emirate: body.emirate || 'Dubai',
      area: body.area,
      community: body.community || null,
      price: Number(body.price),
      beds: body.beds == null ? null : Number(body.beds),
      baths: body.baths == null ? null : Number(body.baths),
      size: body.size == null ? null : Number(body.size),
      description: body.description || '',
      status: 'draft',
      ownerType: 'developer',
      ownerDeveloper: member.id,
      ownerDirect: Boolean(body.ownerDirect),
      claimable: Boolean(body.ownerDirect && body.claimable),
      brokers: requestedBrokers.map(Number),
      appData: { ownerMemberId: member.id, ownerType: 'developer', ownerDirect: Boolean(body.ownerDirect) },
    } as any,
    overrideAccess: true,
  });
  return NextResponse.json({ ok: true, property }, { status: 201 });
}
