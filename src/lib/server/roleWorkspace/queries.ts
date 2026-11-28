import 'server-only';
import { publicListing } from '@/lib/publicListing';
import { NextResponse } from 'next/server';
import { listingFromProperty } from '@/lib/server/member-properties';
import type { MemberContext } from '../memberContext';
import { agencyId, memberRole } from './member';

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

export async function readWorkspace({ payload, member }: MemberContext, params: URLSearchParams) {
  const role = memberRole(member);
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
        const portfolio = teamMember.profile?.portfolio || {};
        return {
          id: broker.id,
          memberId: teamMember.id,
          name: broker.name || portfolio.displayName || teamMember.name,
          email: teamMember.email,
          // Licence and public contact used for the listing's permit and contact steps.
          brn: teamMember.profile?.credentials?.brn || broker.reraNumber || '',
          phone: portfolio.publicPhone || broker.phone || '',
          whatsapp: portfolio.whatsapp || broker.whatsapp || '',
          publicEmail: portfolio.publicEmail || broker.email || '',
        };
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
    // Agency listings only: team brokers' own listings are theirs alone, so the agency does not load them.
    const properties = (ownedResult.docs as any[])
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .map(listingFromProperty);
    const team = (teamResult.docs as any[]).filter((item) => String(item.id) !== String(member.id)).map((item) => {
      const portfolio = item.profile?.portfolio || {};
      // Profile facts the agency dashboard's Team section shows (eligibility = verified BRN + public profile).
      return { id: item.id, name: portfolio.displayName || item.name, email: item.email, accountType: item.accountType, agencyRole: item.profile?.agency?.agencyRole || 'agency_broker',
        slug: portfolio.slug || '', photo: portfolio.photo || '', title: portfolio.title || '', areas: Array.isArray(portfolio.areas) ? portfolio.areas : [],
        isPublic: portfolio.isPublic !== false && Boolean(portfolio.slug), verified: item.credentialStatus === 'verified' && Boolean(item.profile?.credentials?.brn) };
    });
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
  return readDashboard({ payload, member }, role);
}

async function readDashboard({ payload, member }: MemberContext, role: string) {
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
