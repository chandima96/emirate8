import { publicListing } from '@/lib/publicListing';
import { NextResponse } from 'next/server';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { randomUUID } from 'node:crypto';
import { listingFromProperty } from '@/lib/server/member-properties';
import { generateTemporaryPassword, sendNewMemberCredentials, smtpFailureHint } from '@/lib/server/mailer';
import { syncMemberBroker } from '@/lib/server/member-brokers';
import { PLAN_CATALOG, planIdForAudience } from '@/config/plans';

export const dynamic = 'force-dynamic';

async function context(request: Request) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || user.collection !== 'members') return null;
  const member: any = await payload.findByID({ collection: 'members', id: user.id, overrideAccess: true });
  if (member.isSuspended === true) return null;
  return { payload, member };
}

function memberRole(member: any) {
  return member.accountType === 'owner' ? 'developer' : member.accountType;
}

function agencyId(member: any) {
  return member.profile?.agency?.agencyId || member.profile?.agencyId || null;
}

async function notifications(payload: any, memberId: number) {
  const result = await payload.find({
    collection: 'notifications',
    where: { recipient: { equals: memberId } },
    sort: '-createdAt',
    limit: 100,
    depth: 1,
    overrideAccess: true,
  });
  return result.docs.filter((item: any) => {
    const title = String(item.title || '').trim();
    const message = String(item.message || '').trim();
    return title && !/^notification\s*\d+$/i.test(title) && !/^notification\s*\d+$/i.test(message);
  }).map((item: any) => ({
    ...item,
    propertySlug: typeof item.property === 'object' && item.property ? item.property.slug || '' : '',
  }));
}

export async function GET(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { payload, member } = current;
  const role = memberRole(member);
  const params = new URL(request.url).searchParams;
  if (params.get('notifications') === '1') {
    return NextResponse.json({ notifications: await notifications(payload, member.id) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const search = params.get('teamSearch')?.trim();
  if (role === 'agency' && search && search.length >= 2) {
    const brokerResult = await payload.find({
      collection: 'members',
      where: {
        and: [
          { accountType: { equals: 'broker' } },
          { or: [
            { name: { like: search } },
            { email: { like: search } },
            { 'profile.portfolio.displayName': { like: search } },
          ] },
        ],
      },
      limit: 30,
      depth: 0,
      overrideAccess: true,
    });
    return NextResponse.json({ brokerSearch: brokerResult.docs
      .filter((item: any) => !item.profile?.agency?.agencyId && !item.profile?.agencyId && item.id !== member.id)
      .map((item: any) => ({ id: item.id, name: item.profile?.portfolio?.displayName || item.name, email: item.email })) });
  }
  if (role === 'agency' && params.get('teamBrokers') === '1') {
    const currentAgencyId = agencyId(member);
    if (!currentAgencyId) return NextResponse.json({ teamBrokers: [] });
    const [teamMembers, brokers] = await Promise.all([
      payload.find({ collection: 'members', where: { or: [{ 'profile.agency.agencyId': { equals: currentAgencyId } }, { 'profile.agencyId': { equals: currentAgencyId } }] }, limit: 500, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'brokers', limit: 1000, depth: 0, overrideAccess: true }),
    ]);
    const eligibleMembers = new Map((teamMembers.docs as any[])
      .filter((item) => item.profile?.agency?.agencyRole === 'agency_broker')
      .map((item) => [String(item.id), item]));
    const teamBrokers = (brokers.docs as any[])
      .filter((broker) => eligibleMembers.has(String(broker.appData?.ownerMemberId)))
      .map((broker) => {
        const teamMember: any = eligibleMembers.get(String(broker.appData?.ownerMemberId));
        return { id: broker.id, memberId: teamMember.id, name: broker.name || teamMember.profile?.portfolio?.displayName || teamMember.name, email: teamMember.email };
      });
    return NextResponse.json({ teamBrokers });
  }
  if (role === 'developer' && params.get('editorContext') === '1') {
    const brokers = await payload.find({ collection: 'brokers', limit: 500, depth: 0, overrideAccess: true });
    return NextResponse.json({ brokers: brokers.docs.filter((item: any) => item.type !== 'buyer' && item.verified !== false).map((item: any) => ({ id: item.id, name: item.name, verified: item.verified !== false })) });
  }
  if (role === 'developer' && params.get('developerDashboard') === '1') {
    const [properties, claims] = await Promise.all([
      payload.find({ collection: 'properties', where: { or: [{ ownerDeveloper: { equals: member.id } }, { 'appData.ownerMemberId': { equals: member.id } }] }, limit: 500, depth: 2, overrideAccess: true }),
      payload.find({ collection: 'property-broker-claims', where: { developer: { equals: member.id } }, sort: '-createdAt', limit: 200, depth: 2, overrideAccess: true }),
    ]);
    return NextResponse.json({
      properties: properties.docs.map(listingFromProperty),
      claims: claims.docs,
    });
  }
  if (role === 'agency' && ['agencyDashboard', 'agencyTeam'].some((key) => params.get(key) === '1')) {
    const currentAgencyId = agencyId(member);
    if (!currentAgencyId) return NextResponse.json({ properties: [], team: [], invitations: [], notifications: [] });
    const includeProperties = params.get('agencyDashboard') === '1';
    const [teamResult, invitationResult, ownedResult, notificationResult] = await Promise.all([
      payload.find({ collection: 'members', where: { or: [{ 'profile.agency.agencyId': { equals: currentAgencyId } }, { 'profile.agencyId': { equals: currentAgencyId } }] }, limit: 500, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'agency-invitations', where: { agency: { equals: currentAgencyId } }, sort: '-createdAt', limit: 100, overrideAccess: true }),
      includeProperties ? payload.find({ collection: 'properties', where: { or: [{ ownerAgency: { equals: currentAgencyId } }, { 'appData.ownerMemberId': { equals: member.id } }] }, limit: 500, depth: 2, overrideAccess: true }) : Promise.resolve({ docs: [] as any[] }),
      includeProperties ? notifications(payload, member.id) : Promise.resolve([]),
    ]);
    const brokerMemberIds = includeProperties ? (teamResult.docs as any[]).filter((item) => item.profile?.agency?.agencyRole === 'agency_broker').map((item) => item.id) : [];
    const brokerPropertyResult = includeProperties && brokerMemberIds.length
      ? await payload.find({ collection: 'properties', where: { 'appData.ownerMemberId': { in: brokerMemberIds } }, limit: 500, depth: 2, overrideAccess: true })
      : { docs: [] as any[] };
    const uniqueProperties = new Map<string, any>();
    [...(ownedResult.docs as any[]), ...(brokerPropertyResult.docs as any[])].forEach((property) => uniqueProperties.set(String(property.id), property));
    const properties = [...uniqueProperties.values()]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .map(listingFromProperty);
    const team = (teamResult.docs as any[]).filter((item) => String(item.id) !== String(member.id)).map((item) => ({ id: item.id, name: item.name, email: item.email, accountType: item.accountType, agencyRole: item.profile?.agency?.agencyRole || 'agency_broker' }));
    return NextResponse.json({ properties, team, invitations: invitationResult.docs, notifications: notificationResult });
  }
  const developerNetworkMode = params.get('developerNetwork');
  if (['broker', 'agency'].includes(role) && ['1', 'preview'].includes(developerNetworkMode || '')) {
    const previewOnly = developerNetworkMode === 'preview';
    const [developers, propertyResult, subscriptions] = await Promise.all([
      previewOnly ? Promise.resolve({ docs: [] as any[] }) : payload.find({ collection: 'members', where: { accountType: { equals: 'developer' } }, limit: 200, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'properties', where: { and: [{ ownerType: { equals: 'developer' } }, { status: { equals: 'published' } }] }, sort: '-updatedAt', limit: previewOnly ? 3 : 500, depth: 1, overrideAccess: true }),
      previewOnly ? Promise.resolve({ docs: [] as any[] }) : payload.find({ collection: 'developer-subscriptions', where: { broker: { equals: member.id } }, sort: '-createdAt', limit: 200, depth: 1, overrideAccess: true }),
    ]);
    const visibleDevelopers = (developers.docs as any[]).filter((item) => item.credentialStatus !== 'rejected' && item.profile?.developer?.public !== false).map((item) => ({ id: item.id, name: item.name, profile: item.profile || {} }));
    const developerProperties = (propertyResult.docs as any[]).filter((item) => item.display?.visible !== false).map((item) => {
      const listing = publicListing(listingFromProperty(item));
      const developer = item.ownerDeveloper && typeof item.ownerDeveloper === 'object' ? item.ownerDeveloper : null;
      return { ...listing, developerId: developer?.id || item.ownerDeveloper || item.appData?.ownerMemberId, developerName: developer?.name || 'Developer inventory', updatedAt: item.updatedAt };
    });
    return NextResponse.json({ role, developers: visibleDevelopers, developerProperties, subscriptions: subscriptions.docs });
  }
  const [propertyResult, claimResult, subscriptionResult, notificationResult, teamResult, invitationResult] = await Promise.all([
    payload.find({
      collection: 'properties',
      where: {
        or: [
          { ownerDeveloper: { equals: member.id } },
          { 'appData.ownerMemberId': { equals: member.id } },
        ],
      },
      limit: 500,
      depth: 2,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'property-broker-claims',
      where: role === 'developer' ? { developer: { equals: member.id } } : { brokerMember: { equals: member.id } },
      sort: '-createdAt',
      limit: 200,
      depth: 2,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'developer-subscriptions',
      where: role === 'developer' ? { developer: { equals: member.id } } : { broker: { equals: member.id } },
      sort: '-createdAt',
      limit: 200,
      depth: 1,
      overrideAccess: true,
    }),
    notifications(payload, member.id),
    role === 'agency' && agencyId(member)
      ? payload.find({ collection: 'members', where: { or: [{ 'profile.agency.agencyId': { equals: agencyId(member) } }, { 'profile.agencyId': { equals: agencyId(member) } }] }, limit: 500, overrideAccess: true })
      : Promise.resolve({ docs: [] }),
    role === 'agency' && agencyId(member)
      ? payload.find({ collection: 'agency-invitations', where: { agency: { equals: agencyId(member) } }, sort: '-createdAt', limit: 100, overrideAccess: true })
      : Promise.resolve({ docs: [] }),
  ]);
  let workspaceProperties = propertyResult.docs as any[];
  if (role === 'agency') {
    const brokerMemberIds = (teamResult.docs as any[])
      .filter((item) => item.profile?.agency?.agencyRole === 'agency_broker')
      .map((item) => item.id);
    if (brokerMemberIds.length) {
      const brokerPropertyResult = await payload.find({
        collection: 'properties',
        where: { 'appData.ownerMemberId': { in: brokerMemberIds } },
        limit: 500,
        depth: 2,
        overrideAccess: true,
      });
      const uniqueProperties = new Map<string, any>();
      [...workspaceProperties, ...(brokerPropertyResult.docs as any[])].forEach((property) => {
        uniqueProperties.set(String(property.id), property);
      });
      workspaceProperties = [...uniqueProperties.values()];
    }
    workspaceProperties.sort((a, b) => {
      const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bDate - aDate;
    });
  }
  const developerResult = role === 'broker' || role === 'agency'
    ? await payload.find({ collection: 'members', where: { accountType: { equals: 'developer' } }, limit: 200, depth: 0, overrideAccess: true })
    : { docs: [] };
  const developerPropertyResult = role === 'broker' || role === 'agency'
    ? await payload.find({
        collection: 'properties',
        where: { and: [{ ownerType: { equals: 'developer' } }, { status: { equals: 'published' } }] },
        sort: '-updatedAt',
        limit: 500,
        depth: 1,
        overrideAccess: true,
      })
    : { docs: [] };
  const brokerResult = role === 'developer'
    ? await payload.find({ collection: 'brokers', limit: 500, depth: 0, overrideAccess: true })
    : { docs: [] };
  return NextResponse.json({
    role,
    member: { id: member.id, name: member.name, profile: member.profile || {} },
    properties: workspaceProperties.map(listingFromProperty),
    claims: claimResult.docs,
    subscriptions: subscriptionResult.docs,
    notifications: notificationResult,
    team: teamResult.docs
      .filter((item: any) => String(item.id) !== String(member.id))
      .map((item: any) => ({ id: item.id, name: item.name, email: item.email, accountType: item.accountType, agencyRole: item.profile?.agency?.agencyRole || 'agency_broker' })),
    invitations: invitationResult.docs,
    agency: agencyId(member) ? { id: agencyId(member) } : null,
    developers: developerResult.docs
      .filter((item: any) => item.credentialStatus !== 'rejected' && item.profile?.developer?.public !== false)
      .map((item: any) => ({ id: item.id, name: item.name, profile: item.profile || {} })),
    developerProperties: developerPropertyResult.docs
      .filter((item: any) => item.display?.visible !== false)
      .map((item: any) => {
        const listing = publicListing(listingFromProperty(item));
        const developer = item.ownerDeveloper && typeof item.ownerDeveloper === 'object' ? item.ownerDeveloper : null;
        return {
          ...listing,
          developerId: developer?.id || item.ownerDeveloper || item.appData?.ownerMemberId,
          developerName: developer?.name || 'Developer inventory',
          updatedAt: item.updatedAt,
        };
      }),
    brokers: brokerResult.docs.filter((item: any) => item.type !== 'buyer' && item.verified !== false).map((item: any) => ({ id: item.id, name: item.name, verified: item.verified !== false })),
    brokerSearch: [],
  });
}

export async function POST(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { payload, member } = current;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.action === 'mark-notification-read') {
    const notification: any = await payload.findByID({ collection: 'notifications', id: body.id, overrideAccess: true });
    if (!notification || String(notification.recipient?.id || notification.recipient) !== String(member.id))
      return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    await payload.update({ collection: 'notifications', id: body.id, data: { read: true }, overrideAccess: true });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'subscribe-developer') {
    if (!['broker', 'agency'].includes(memberRole(member))) return NextResponse.json({ error: 'Only brokers and agencies can subscribe.' }, { status: 403 });
    if (!body.developerId) return NextResponse.json({ error: 'Developer is required.' }, { status: 400 });
    const existing = await payload.find({
      collection: 'developer-subscriptions',
      where: { and: [{ developer: { equals: body.developerId } }, { broker: { equals: member.id } }] },
      limit: 1,
      overrideAccess: true,
    });
    const subscription = existing.docs[0]
      ? await payload.update({ collection: 'developer-subscriptions', id: existing.docs[0].id, data: { status: 'active' }, overrideAccess: true })
      : await payload.create({ collection: 'developer-subscriptions', data: { developer: body.developerId, broker: member.id, status: 'active' }, overrideAccess: true });
    return NextResponse.json({ ok: true, subscription });
  }

  if (body.action === 'unsubscribe-developer') {
    if (!['broker', 'agency'].includes(memberRole(member))) return NextResponse.json({ error: 'Only brokers and agencies can unsubscribe.' }, { status: 403 });
    if (!body.developerId) return NextResponse.json({ error: 'Developer is required.' }, { status: 400 });
    const existing = await payload.find({
      collection: 'developer-subscriptions',
      where: { and: [{ developer: { equals: body.developerId } }, { broker: { equals: member.id } }] },
      limit: 1,
      overrideAccess: true,
    });
    if (!existing.docs[0]) return NextResponse.json({ ok: true });
    const subscription = await payload.update({
      collection: 'developer-subscriptions',
      id: existing.docs[0].id,
      data: { status: 'cancelled' },
      overrideAccess: true,
    });
    return NextResponse.json({ ok: true, subscription });
  }

  if (body.action === 'invite-team') {
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

  if (body.action === 'cancel-team-invite') {
    if (memberRole(member) !== 'agency') return NextResponse.json({ error: 'Only agency accounts can cancel invitations.' }, { status: 403 });
    const invitation: any = await payload.findByID({ collection: 'agency-invitations', id: body.id, overrideAccess: true });
    if (!invitation || String(invitation.agency?.id || invitation.agency) !== String(agencyId(member))) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    await payload.update({ collection: 'agency-invitations', id: invitation.id, data: { status: 'cancelled' }, overrideAccess: true });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'accept-team-invite') {
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

  if (body.action === 'create-claim') {
    if (memberRole(member) !== 'broker') return NextResponse.json({ error: 'Only brokers can request representation.' }, { status: 403 });
    const property: any = await payload.findByID({ collection: 'properties', id: body.propertyId, overrideAccess: true });
    if (!property?.ownerDirect || !property?.claimable) return NextResponse.json({ error: 'This property is not open for claims.' }, { status: 400 });
    if (property.primaryBroker || property.broker) return NextResponse.json({ error: 'This property already has a primary broker.' }, { status: 409 });
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

  if (body.action === 'decide-claim') {
    if (memberRole(member) !== 'developer') return NextResponse.json({ error: 'Only the developer can decide claims.' }, { status: 403 });
    const claim: any = await payload.findByID({ collection: 'property-broker-claims', id: body.claimId, overrideAccess: true });
    if (!claim || String(claim.developer?.id || claim.developer) !== String(member.id)) return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
    if (!['approved', 'rejected'].includes(body.decision)) return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
    const property: any = await payload.findByID({ collection: 'properties', id: claim.property?.id || claim.property, overrideAccess: true });
    const brokerMemberId = claim.brokerMember?.id || claim.brokerMember;
    if (body.decision === 'approved') {
      if (property.primaryBroker || property.broker) return NextResponse.json({ error: 'A primary broker is already assigned.' }, { status: 409 });
      const brokers = await payload.find({ collection: 'brokers', where: { appData: { contains: String(brokerMemberId) } }, limit: 1, overrideAccess: true });
      const broker = brokers.docs[0];
      if (!broker) return NextResponse.json({ error: 'The broker must complete a public broker profile before approval.' }, { status: 409 });
      await payload.update({ collection: 'properties', id: property.id, data: { primaryBroker: broker.id, broker: broker.id, claimable: false, ownerDirect: false }, overrideAccess: true });
      await payload.update({ collection: 'property-broker-claims', where: { and: [{ property: { equals: property.id } }, { status: { equals: 'pending' } }] }, data: { status: 'cancelled', decisionReason: 'Another broker was approved for this property.' }, overrideAccess: true });
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

  if (body.action === 'create-developer-property') {
    if (memberRole(member) !== 'developer') return NextResponse.json({ error: 'Only developers can create developer properties.' }, { status: 403 });
    if (!body.title || !body.area || !body.type || !body.purpose || !body.price) return NextResponse.json({ error: 'Title, area, type, purpose and price are required.' }, { status: 400 });
    if (!body.ownerDirect && !body.primaryBroker) return NextResponse.json({ error: 'Select a primary broker or choose owner-direct publishing.' }, { status: 400 });
    const owned = await payload.find({ collection: 'properties', where: { ownerDeveloper: { equals: member.id } }, limit: 1, pagination: false, overrideAccess: true });
    const developerPlanId = planIdForAudience(member.plan, 'developer');
    const propertyLimit = PLAN_CATALOG[developerPlanId].listings;
    if (propertyLimit != null && owned.totalDocs >= propertyLimit) return NextResponse.json({ error: `Your Developer ${PLAN_CATALOG[developerPlanId].name} plan has reached its ${propertyLimit}-property limit.` }, { status: 403 });
    if (body.primaryBroker) {
      const broker = await payload.findByID({ collection: 'brokers', id: body.primaryBroker, overrideAccess: true });
      if (!broker) return NextResponse.json({ error: 'Selected primary broker was not found.' }, { status: 400 });
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
        ...(body.primaryBroker ? { primaryBroker: body.primaryBroker, broker: body.primaryBroker } : {}),
        appData: { ownerMemberId: member.id, ownerType: 'developer', ownerDirect: Boolean(body.ownerDirect) },
      } as any,
      overrideAccess: true,
    });
    return NextResponse.json({ ok: true, property }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unsupported role workspace action.' }, { status: 400 });
}
