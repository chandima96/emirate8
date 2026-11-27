import 'server-only';
import type { Payload } from 'payload';
import { planIdForAudience } from '@/config/plans';
import { brokerIdsOf } from '@/lib/propertyBrokers';
import { syncMemberBroker } from './member-brokers';
import { invalidateCmsCache } from '@/lib/payloadCacheHooks';

/*
 * Removing someone from an agency team (Team page → Remove). Only the agency admin can do it.
 *
 * - A team broker is never deleted: they become an independent broker with the same login. They keep
 *   all their own listings (those were always theirs) and are taken off the agency's listings.
 * - Managers and viewers have no account of their own outside the agency, so their account is deleted.
 *   Any listing they created is handed to the agency admin first, so it stays with the agency.
 */

type Result = { error: string; status: number } | { ok: true; outcome: 'independent' | 'deleted' };

const relationId = (value: any) => (value && typeof value === 'object' ? String(value.id) : value == null ? '' : String(value));

export function memberAgencyId(member: any) {
  return relationId(member?.profile?.agency?.agencyId ?? member?.profile?.agencyId) || null;
}

/** The agency's own account: an agency member who is not a team broker, manager or viewer. */
export function isAgencyAdmin(member: any) {
  const role = member?.profile?.agency?.agencyRole;
  return member?.accountType === 'agency' && Boolean(memberAgencyId(member)) && (!role || role === 'agency_admin');
}

async function updateProperty(payload: Payload, doc: any, data: Record<string, unknown>, appData: Record<string, unknown>) {
  await payload.update({
    collection: 'properties',
    id: doc.id,
    data: { ...data, appData: { ...(doc.appData || {}), ...appData } } as any,
    depth: 0,
    overrideAccess: true,
  });
}

async function makeIndependent(payload: Payload, member: any, agencyId: string) {
  // 1. Take the broker off the agency's listings (the listings stay with the agency).
  const own = await payload.find({ collection: 'brokers', where: { 'appData.ownerMemberId': { equals: member.id } }, limit: 5, depth: 0, overrideAccess: true });
  const rowIds = new Set((own.docs as any[]).filter((doc) => Number(doc.appData?.ownerMemberId) === Number(member.id)).map((doc) => String(doc.id)));
  if (rowIds.size) {
    const assigned = await payload.find({
      collection: 'properties',
      where: { and: [{ ownerAgency: { equals: agencyId } }, { brokers: { in: [...rowIds] } }] },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });
    for (const doc of assigned.docs as any[]) {
      const brokers = brokerIdsOf(doc).filter((id) => !rowIds.has(id));
      await updateProperty(payload, doc, { brokers: brokers.map(Number) }, { brokers });
    }
  }

  // 2. Their own listings carry no agency ownership (older data may still have it).
  const ownListings = await payload.find({
    collection: 'properties',
    where: { and: [{ 'appData.ownerMemberId': { equals: member.id } }, { ownerAgency: { equals: agencyId } }] },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  for (const doc of ownListings.docs as any[]) {
    await updateProperty(payload, doc, { ownerAgency: null, ownerType: 'other' }, { ownerAgency: null, ownerType: 'other' });
  }

  // 3. The account becomes an independent broker account (same login, broker plan tier).
  const { agency: _agency, agencyId: _legacyAgencyId, ...profile } = member.profile || {};
  const { agency: _portfolioAgency, ...portfolio } = profile.portfolio || {};
  const updated = await payload.update({
    collection: 'members',
    id: member.id,
    data: {
      accountType: 'broker',
      plan: planIdForAudience(member.plan, 'broker'),
      profile: { ...profile, ...(profile.portfolio ? { portfolio } : {}) },
    } as any,
    depth: 0,
    overrideAccess: true,
  });
  await syncMemberBroker(payload, updated);
}

async function deleteMember(payload: Payload, member: any, admin: any) {
  // Hand any listing they created to the agency admin, so it does not disappear with the account.
  const listings = await payload.find({
    collection: 'properties',
    where: { 'appData.ownerMemberId': { equals: member.id } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  for (const doc of listings.docs as any[]) {
    await updateProperty(payload, doc, {}, { ownerMemberId: Number(admin.id) });
  }
  await payload.delete({ collection: 'member-state', where: { member: { equals: member.id } }, overrideAccess: true });
  await payload.delete({ collection: 'members', id: member.id, overrideAccess: true });
}

export async function removeTeamMember(payload: Payload, admin: any, targetId: unknown): Promise<Result> {
  if (!isAgencyAdmin(admin)) return { error: 'Only the agency admin can remove team members.', status: 403 };
  const agencyId = memberAgencyId(admin)!;
  if (!/^\d+$/.test(String(targetId ?? ''))) return { error: 'Choose a team member to remove.', status: 400 };
  if (String(targetId) === String(admin.id)) return { error: 'You cannot remove your own agency account.', status: 400 };

  const member: any = await payload.findByID({ collection: 'members', id: Number(targetId), depth: 0, overrideAccess: true, disableErrors: true });
  if (!member || memberAgencyId(member) !== agencyId) return { error: 'That person is not on your team.', status: 404 };
  if (isAgencyAdmin(member)) return { error: 'Another agency admin account cannot be removed here.', status: 403 };

  try {
    if (member.profile?.agency?.agencyRole === 'agency_broker') {
      await makeIndependent(payload, member, agencyId);
      return { ok: true, outcome: 'independent' };
    }
    await deleteMember(payload, member, admin);
    return { ok: true, outcome: 'deleted' };
  } catch (error) {
    console.error('[agency-team] Could not remove team member:', error instanceof Error ? error.stack || error.message : error);
    return { error: 'The team member could not be removed. Please try again.', status: 500 };
  } finally {
    await invalidateCmsCache().catch(() => undefined);
  }
}
