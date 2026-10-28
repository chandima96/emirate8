import { NextResponse } from 'next/server';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { listingFromProperty, syncMemberProperties } from '@/lib/server/member-properties';

export const dynamic = 'force-dynamic';

async function getContext(request: Request) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers });

  if (!user || user.collection !== 'members') return null;
  return { payload, user };
}

async function agencyListingState(payload: any, memberId: number, value: any) {
  const member: any = await payload.findByID({ collection: 'members', id: memberId, depth: 0, overrideAccess: true });
  if (member.accountType !== 'agency' || !Array.isArray(value?.listings)) return { value };
  const agencyId = member.profile?.agency?.agencyId || member.profile?.agencyId;
  if (!agencyId) return { error: 'Your agency profile is missing its agency record.' };

  const assignments = value.listings.filter((listing: any) => listing?.primaryBroker).map((listing: any) => String(listing.primaryBroker));
  if (assignments.length) {
    const [team, brokers] = await Promise.all([
      payload.find({ collection: 'members', where: { or: [{ 'profile.agency.agencyId': { equals: agencyId } }, { 'profile.agencyId': { equals: agencyId } }] }, limit: 500, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'brokers', limit: 1000, depth: 0, overrideAccess: true }),
    ]);
    const eligibleMemberIds = new Set((team.docs as any[])
      .filter((item) => item.profile?.agency?.agencyRole === 'agency_broker')
      .map((item) => String(item.id)));
    const assignedBrokers = new Map((brokers.docs as any[]).map((broker) => [String(broker.id), broker]));
    for (const brokerId of assignments) {
      const broker: any = assignedBrokers.get(brokerId);
      if (!broker || !eligibleMemberIds.has(String(broker.appData?.ownerMemberId))) {
        return { error: 'Choose a primary broker who belongs to your agency team.' };
      }
    }
  }

  return {
    value: {
      ...value,
      listings: value.listings.map((listing: any) => ({ ...listing, ownerType: 'agency', ownerAgency: agencyId })),
    },
  };
}

export async function GET(request: Request) {
  const context = await getContext(request);
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { docs } = await context.payload.find({
    collection: 'member-state',
    where: { member: { equals: context.user.id } },
    limit: 100,
    overrideAccess: true,
  });

  const state = Object.fromEntries(docs.map((doc) => [doc.key, doc.state]));
  const properties = await context.payload.find({
    collection: 'properties',
    where: { 'appData.ownerMemberId': { equals: context.user.id } },
    pagination: false,
    // Populate uploaded permit media so the listing editor can display the
    // saved filename and open the document after a reload.
    depth: 1,
    overrideAccess: true,
  });
  const key = `data:${context.user.id}`;
  const workspace = state[key];
  state[key] = {
    selected: [],
    activity: [],
    ...(workspace && typeof workspace === 'object' && !Array.isArray(workspace) ? workspace : {}),
    listings: properties.docs.map(listingFromProperty),
  };
  return NextResponse.json({ state }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function PUT(request: Request) {
  const context = await getContext(request);
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let body: { key?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body.key !== 'string' || !body.key || body.key.length > 120) {
    return NextResponse.json({ error: 'A valid state key is required.' }, { status: 400 });
  }

  // Accounts and login sessions are managed by Payload Auth, never by client state.
  if (body.key === 'users' || body.key === 'session' || body.key === 'version') {
    return NextResponse.json({ error: 'This state key is managed by the server.' }, { status: 400 });
  }

  if (body.key.startsWith('data:') && body.key !== `data:${context.user.id}`) {
    return NextResponse.json({ error: 'Invalid workspace key.' }, { status: 403 });
  }

  let value = body.value;
  if (body.key === `data:${context.user.id}`) {
    const member: any = await context.payload.findByID({ collection: 'members', id: context.user.id, depth: 0, overrideAccess: true });
    const agencyRole = member.profile?.agency?.agencyRole;
    if (member.accountType === 'agency' && agencyRole === 'agency_broker' && Array.isArray((value as any)?.listings)) {
      const credentials = member.profile?.credentials || {};
      const hasCredentials = /^\d{3,8}$/.test(String(credentials.brn || '')) && Boolean(credentials.expiry) && Boolean(credentials.cardFile);
      if (!hasCredentials || member.credentialStatus !== 'verified') {
        return NextResponse.json({ error: 'Complete RERA credential verification before adding property listings.' }, { status: 403 });
      }
    }
    const agencyState = await agencyListingState(context.payload, Number(context.user.id), value);
    if (agencyState.error) return NextResponse.json({ error: agencyState.error }, { status: 403 });
    value = agencyState.value;
  }

  let savedListings: { id: string; slug: string }[] | undefined;
  // Save the canonical properties before acknowledging a workspace save.
  if (body.key === `data:${context.user.id}`) {
    try {
      savedListings = await syncMemberProperties(context.payload, Number(context.user.id), value);
    } catch (error) {
      console.error('[app-state] Could not sync member properties:', error);
      const message = error instanceof Error ? error.message : 'Could not sync member properties.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const existing = await context.payload.find({
    collection: 'member-state',
    where: {
      and: [{ member: { equals: context.user.id } }, { key: { equals: body.key } }],
    },
    limit: 1,
    overrideAccess: true,
  });

  if (existing.docs[0]) {
    await context.payload.update({
      collection: 'member-state',
      id: existing.docs[0].id,
      data: { state: value },
      overrideAccess: true,
    });
  } else {
    await context.payload.create({
      collection: 'member-state',
      data: { member: context.user.id, key: body.key, state: value },
      overrideAccess: true,
    });
  }

  return NextResponse.json({ ok: true, ...(savedListings ? { listings: savedListings } : {}) });
}

export async function DELETE(request: Request) {
  const context = await getContext(request);
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (typeof body.key !== 'string' || !body.key || body.key.length > 120) {
    return NextResponse.json({ error: 'A valid state key is required.' }, { status: 400 });
  }
  if (body.key === '*') {
    await context.payload.delete({
      collection: 'member-state',
      where: { member: { equals: context.user.id } },
      overrideAccess: true,
    });
    return NextResponse.json({ ok: true });
  }

  const existing = await context.payload.find({
    collection: 'member-state',
    where: {
      and: [{ member: { equals: context.user.id } }, { key: { equals: body.key } }],
    },
    limit: 1,
    overrideAccess: true,
  });
  if (existing.docs[0]) {
    await context.payload.delete({ collection: 'member-state', id: existing.docs[0].id, overrideAccess: true });
  }
  return NextResponse.json({ ok: true });
}
