import 'server-only';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { generateTemporaryPassword, sendNewMemberCredentials, smtpFailureHint } from '@/lib/server/mailer';
import { syncMemberBroker } from '@/lib/server/member-brokers';
import { removeTeamMember } from '@/lib/server/agencyTeam';
import { PLAN_CATALOG, planIdForAudience } from '@/config/plans';
import type { MemberContext } from '../memberContext';
import { agencyId, memberRole } from './member';

export async function inviteTeam({ payload, member }: MemberContext, body: Record<string, any>) {
  if (memberRole(member) !== 'agency') return NextResponse.json({ error: 'Only agency accounts can invite team members.' }, { status: 403 });
  const currentAgencyId = agencyId(member);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!currentAgencyId || !email) return NextResponse.json({ error: 'Agency and invitee email are required.' }, { status: 400 });
  const agencyMembers = await payload.find({ collection: 'members', where: { 'profile.agency.agencyId': { equals: currentAgencyId } }, limit: 100, overrideAccess: true });
  const pendingInvites = await payload.find({ collection: 'agency-invitations', where: { and: [{ agency: { equals: currentAgencyId } }, { status: { equals: 'pending' } }] }, limit: 100, overrideAccess: true });
  const agencyPlanId = planIdForAudience(member.plan, 'agency');
  const seatLimit = PLAN_CATALOG[agencyPlanId].seats;
  if (seatLimit != null && agencyMembers.totalDocs + pendingInvites.totalDocs >= seatLimit) return NextResponse.json({ error: `Your ${PLAN_CATALOG[agencyPlanId].name} plan has reached its ${seatLimit}-seat limit.` }, { status: 403 });
  const existing = await payload.find({
    collection: 'agency-invitations',
    where: { and: [{ agency: { equals: currentAgencyId } }, { email: { equals: email } }, { status: { equals: 'pending' } }] },
    limit: 1,
    overrideAccess: true,
  });
  if (existing.docs[0]) return NextResponse.json({ error: 'This email already has a pending invitation.' }, { status: 409 });
  const invitation = await payload.create({
    collection: 'agency-invitations',
    data: {
      agency: currentAgencyId,
      invitedBy: member.id,
      email,
      name: typeof body.name === 'string' ? body.name.trim() : '',
      role: ['agency_manager', 'agency_broker', 'agency_viewer'].includes(body.role) ? body.role : 'agency_broker',
      status: 'pending',
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    overrideAccess: true,
  });
  const existingMember = (await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, overrideAccess: true })).docs[0] as any;
  const agencyDoc: any = await payload.findByID({ collection: 'agencies', id: currentAgencyId, overrideAccess: true });
  if (existingMember) {
    if (existingMember.accountType !== 'broker' || existingMember.profile?.agency?.agencyId) {
      await payload.delete({ collection: 'agency-invitations', id: invitation.id, overrideAccess: true });
      return NextResponse.json({ error: 'That email already belongs to an account. Only an independent broker can be linked this way.' }, { status: 409 });
    }
    try {
      await sendNewMemberCredentials({ to: email, name: existingMember.name, agencyName: agencyDoc?.name || 'the agency', invitationToken: invitation.token });
    } catch (error) {
      console.error('[agency-team] Existing broker invitation email failed:', error instanceof Error ? error.message : error);
      await payload.delete({ collection: 'agency-invitations', id: invitation.id, overrideAccess: true });
      return NextResponse.json({ error: smtpFailureHint(error) }, { status: 400 });
    }
    return NextResponse.json({ ok: true, invitation, linkedExistingBroker: true }, { status: 201 });
  }
  const temporaryPassword = generateTemporaryPassword();
  let created: any;
  let createdBroker: any;
  let inviteStage = 'create member account';
  try {
    created = await payload.create({ collection: 'members', overrideAccess: true, data: {
      name: (typeof body.name === 'string' && body.name.trim()) || email.split('@')[0], email,
      password: temporaryPassword, accountType: 'agency',
      profile: { agency: { agencyId: currentAgencyId, agencyRole: invitation.role } },
      credentialStatus: 'pending', plan: planIdForAudience(member.plan, 'agency'), mustChangePassword: true,
    } as any });
    if (invitation.role === 'agency_broker') createdBroker = await syncMemberBroker(payload, created);
    inviteStage = 'send invitation email';
    await sendNewMemberCredentials({ to: email, name: created.name, temporaryPassword, agencyName: agencyDoc?.name || 'the agency' });
    inviteStage = 'mark invitation accepted';
    await payload.update({ collection: 'agency-invitations', id: invitation.id, data: { status: 'accepted' }, overrideAccess: true });
    return NextResponse.json({ ok: true, invitation, member: { id: created.id } }, { status: 201 });
  } catch (error) {
    console.error(`[agency-team] New member invitation failed during ${inviteStage}:`, error instanceof Error ? error.stack || error.message : error);
    if (createdBroker?.id) await payload.delete({ collection: 'brokers', id: createdBroker.id, overrideAccess: true }).catch(() => undefined);
    if (created?.id) await payload.delete({ collection: 'members', id: created.id, overrideAccess: true }).catch(() => undefined);
    await payload.delete({ collection: 'agency-invitations', id: invitation.id, overrideAccess: true }).catch(() => undefined);
    const mailFailed = created?.id != null;
    return NextResponse.json({ error: mailFailed ? `The account was not created because ${smtpFailureHint(error).toLowerCase()}` : (error instanceof Error ? error.message : 'Could not create invitation.') }, { status: 400 });
  }
}

export async function cancelTeamInvite({ payload, member }: MemberContext, body: Record<string, any>) {
  if (memberRole(member) !== 'agency') return NextResponse.json({ error: 'Only agency accounts can cancel invitations.' }, { status: 403 });
  const invitation: any = await payload.findByID({ collection: 'agency-invitations', id: body.id, overrideAccess: true });
  if (!invitation || String(invitation.agency?.id || invitation.agency) !== String(agencyId(member))) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  await payload.update({ collection: 'agency-invitations', id: invitation.id, data: { status: 'cancelled' }, overrideAccess: true });
  return NextResponse.json({ ok: true });
}

export async function removeMember({ payload, member }: MemberContext, body: Record<string, any>) {
  const removed = await removeTeamMember(payload, member, body.id);
  if ('error' in removed) return NextResponse.json({ error: removed.error }, { status: removed.status });
  return NextResponse.json(removed);
}

export async function acceptTeamInvite({ payload, member }: MemberContext, body: Record<string, any>) {
  const token = typeof body.token === 'string' ? body.token : '';
  const invitationResult = await payload.find({ collection: 'agency-invitations', where: { and: [{ token: { equals: token } }, { status: { equals: 'pending' } }] }, limit: 1, overrideAccess: true });
  const invitation: any = invitationResult.docs[0];
  if (!invitation || (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) || String(invitation.email).toLowerCase() !== String(member.email).toLowerCase()) {
    return NextResponse.json({ error: 'This invitation is invalid, expired or belongs to another email.' }, { status: 400 });
  }
  const invitedAccount: any = await payload.find({ collection: 'members', where: { email: { equals: member.email } }, limit: 1, overrideAccess: true });
  const currentMember: any = invitedAccount.docs[0];
  const agencyIdFromInvite = invitation.agency?.id || invitation.agency;
  const agencyDoc: any = await payload.findByID({ collection: 'agencies', id: agencyIdFromInvite, overrideAccess: true });
  const updatedMember: any = await payload.update({
    collection: 'members',
    id: member.id,
    data: { ...(currentMember?.accountType === 'broker' ? { accountType: 'agency' } : {}), profile: { ...(member.profile || {}), agency: { agencyId: agencyIdFromInvite, agencyRole: invitation.role, name: agencyDoc?.name || '' } } },
    overrideAccess: true,
  });
  if (currentMember?.accountType === 'broker') await syncMemberBroker(payload, updatedMember);
  await payload.update({ collection: 'agency-invitations', id: invitation.id, data: { status: 'accepted' }, overrideAccess: true });
  return NextResponse.json({ ok: true });
}
