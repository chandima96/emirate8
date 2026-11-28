import 'server-only';
import { NextResponse } from 'next/server';
import { MAX_PROPERTY_BROKERS, brokerIdsOf } from '@/lib/propertyBrokers';
import type { MemberContext } from '../memberContext';
import { memberRole } from './member';

export async function createClaim({ payload, member }: MemberContext, body: Record<string, any>) {
  if (memberRole(member) !== 'broker') return NextResponse.json({ error: 'Only brokers can request representation.' }, { status: 403 });
  const property: any = await payload.findByID({ collection: 'properties', id: body.propertyId, overrideAccess: true });
  // Open for claims until the property has the maximum number of brokers (claimable is switched off then).
  if (!property?.claimable) return NextResponse.json({ error: 'This property is not open for claims.' }, { status: 400 });
  const currentBrokers = brokerIdsOf(property);
  if (currentBrokers.length >= MAX_PROPERTY_BROKERS) return NextResponse.json({ error: `This property already has ${MAX_PROPERTY_BROKERS} brokers.` }, { status: 409 });
  const ownBroker = await payload.find({ collection: 'brokers', where: { 'appData.ownerMemberId': { equals: member.id } }, limit: 1, depth: 0, overrideAccess: true });
  if (ownBroker.docs[0] && currentBrokers.includes(String(ownBroker.docs[0].id))) return NextResponse.json({ error: 'You already represent this property.' }, { status: 409 });
  const developerId = property.ownerDeveloper || property.appData?.ownerMemberId;
  if (!developerId) return NextResponse.json({ error: 'The property has no developer owner.' }, { status: 400 });
  const existing = await payload.find({
    collection: 'property-broker-claims',
    where: { and: [{ property: { equals: property.id } }, { brokerMember: { equals: member.id } }, { status: { equals: 'pending' } }] },
    limit: 1,
    overrideAccess: true,
  });
  if (existing.docs[0]) return NextResponse.json({ error: 'You already have a pending claim.' }, { status: 409 });
  const claim: any = await payload.create({
    collection: 'property-broker-claims',
    data: { property: property.id, developer: developerId, brokerMember: member.id, status: 'pending', message: body.message || '' },
    overrideAccess: true,
  });
  await payload.create({
    collection: 'notifications',
    data: { recipient: developerId, type: 'claim_request', title: 'New broker claim request', message: `${member.name} requested to represent ${property.title}.`, property: property.id, claim: claim.id, read: false },
    overrideAccess: true,
  });
  return NextResponse.json({ ok: true, claim }, { status: 201 });
}

export async function decideClaim({ payload, member }: MemberContext, body: Record<string, any>) {
  if (memberRole(member) !== 'developer') return NextResponse.json({ error: 'Only the developer can decide claims.' }, { status: 403 });
  const claim: any = await payload.findByID({ collection: 'property-broker-claims', id: body.claimId, overrideAccess: true });
  if (!claim || String(claim.developer?.id || claim.developer) !== String(member.id)) return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
  if (!['approved', 'rejected'].includes(body.decision)) return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
  const property: any = await payload.findByID({ collection: 'properties', id: claim.property?.id || claim.property, overrideAccess: true });
  const brokerMemberId = claim.brokerMember?.id || claim.brokerMember;
  if (body.decision === 'approved') {
    const currentBrokers = brokerIdsOf(property);
    if (currentBrokers.length >= MAX_PROPERTY_BROKERS) return NextResponse.json({ error: `This property already has ${MAX_PROPERTY_BROKERS} brokers.` }, { status: 409 });
    const brokers = await payload.find({ collection: 'brokers', where: { 'appData.ownerMemberId': { equals: brokerMemberId } }, limit: 5, depth: 0, overrideAccess: true });
    const broker: any = (brokers.docs as any[]).find((doc) => String(doc.appData?.ownerMemberId) === String(brokerMemberId));
    if (!broker) return NextResponse.json({ error: 'The broker must complete a public broker profile before approval.' }, { status: 409 });
    const nextBrokers = [...new Set([...currentBrokers, String(broker.id)])].slice(0, MAX_PROPERTY_BROKERS);
    const full = nextBrokers.length >= MAX_PROPERTY_BROKERS;
    // Claims stay open until the property has the maximum number of brokers.
    await payload.update({ collection: 'properties', id: property.id, data: { brokers: nextBrokers.map(Number), ownerDirect: false, ...(full ? { claimable: false } : {}) }, overrideAccess: true });
    if (full) {
      await payload.update({ collection: 'property-broker-claims', where: { and: [{ property: { equals: property.id } }, { status: { equals: 'pending' } }, { id: { not_equals: claim.id } }] }, data: { status: 'cancelled', decisionReason: `This property now has ${MAX_PROPERTY_BROKERS} brokers.` }, overrideAccess: true });
    }
    claim.broker = broker.id;
  }
  const updated = await payload.update({ collection: 'property-broker-claims', id: claim.id, data: { status: body.decision, decisionReason: body.reason || '', reviewedBy: member.id, reviewedAt: new Date().toISOString() }, overrideAccess: true });
  await payload.create({
    collection: 'notifications',
    data: { recipient: brokerMemberId, type: 'claim_decision', title: body.decision === 'approved' ? 'Claim approved' : 'Claim declined', message: `Your request for ${property?.title || 'the property'} was ${body.decision}.`, property: property?.id, claim: claim.id, read: false },
    overrideAccess: true,
  });
  return NextResponse.json({ ok: true, claim: updated });
}
