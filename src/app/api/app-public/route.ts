import { publicListing } from '@/lib/publicListing';
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { listingFromProperty } from '@/lib/server/member-properties';
import { PLAN_CATALOG } from '@/config/plans';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const loadPublicData = unstable_cache(async () => {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const [propertyResult, brokerResult, memberResult, planResult] = await Promise.all([
    payload.find({
      collection: 'properties',
      where: {
        and: [{ status: { equals: 'published' } }, { 'display.visible': { not_equals: false } }],
      },
      limit: 500,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({ collection: 'brokers', limit: 500, depth: 0, overrideAccess: true }),
    payload.find({
      collection: 'members',
      where: {
      and: [{ accountType: { in: ['broker', 'agency', 'developer'] } }, { adminCreated: { not_equals: true } }],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({ collection: 'plans', sort: 'sortOrder', limit: 100, depth: 0, overrideAccess: true }),
  ]);

  const sampleBrokers = brokerResult.docs
    .map((doc: any) => doc.appData)
    .filter(
      (broker: any) =>
        broker &&
        !broker.ownerMemberId &&
        broker.slug &&
        broker.isPublic !== false &&
        broker.searchable !== false,
    );
  // Member workspace listings are also mirrored into properties for administration;
  // they are added below with their broker context, so avoid returning them twice.
  const sampleListings = propertyResult.docs
    .map(listingFromProperty)
    .filter((listing: any) => listing && !listing.ownerMemberId)
    .map(publicListing);
  const memberBrokers: any[] = [];
  const developers = (memberResult.docs as any[])
    .filter((member) => member.accountType === 'developer')
    .map((member) => ({ id: member.id, name: member.name, type: 'developer', profile: member.profile || {} }));
  const developersById = new Map(developers.map((developer) => [String(developer.id), developer]));
  const memberListings: any[] = [];
  for (const member of memberResult.docs as any[]) {
    const profile = member.profile && typeof member.profile === 'object' ? member.profile : {};
    const portfolio = profile.portfolio || {};
    const privacy = profile.privacy || {};
    if (portfolio.isPublic === false || portfolio.searchable === false || !portfolio.slug) continue;

    const name = portfolio.displayName || member.name;
    const broker = {
      id: member.id,
      userId: member.id,
      type: member.accountType === 'agency' ? 'agency' : 'broker',
      slug: portfolio.slug,
      name,
      title:
        portfolio.title || (member.accountType === 'agency' ? 'Real Estate Agency' : 'Licensed Real Estate Broker'),
      location: portfolio.location || '',
      headline: portfolio.headline || '',
      intro: portfolio.intro || '',
      bio: portfolio.bio || '',
      photo: portfolio.photo || '',
      cover: portfolio.cover || '',
      coverPos: portfolio.coverPos ?? 50,
      initials: name
        .split(/\s+/)
        .map((part: string) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      tone: 1,
      areas: portfolio.areas || [],
      languages: privacy.showLanguages === false ? [] : portfolio.languages || [],
      specialties: portfolio.specialties || [],
      experience: privacy.showExperience === false ? '' : portfolio.experience || '',
      brn: privacy.showBrn === false || !profile.credentials?.brn ? '' : `BRN ${profile.credentials.brn}`,
      brnVerified:
        member.credentialStatus === 'verified' && Boolean(profile.credentials?.brn) && privacy.showBrn !== false,
      credentials: [],
      phone: privacy.showPhone === false ? '' : portfolio.publicPhone || '',
      whatsapp: privacy.showWhatsapp === false ? '' : portfolio.whatsapp || '',
      email: privacy.showEmail === false ? '' : portfolio.publicEmail || '',
      preferred: portfolio.preferred || 'whatsapp',
      agency: portfolio.agency?.name ? portfolio.agency : null,
      independent: member.accountType !== 'agency' && !portfolio.agency?.name,
      agencyName: member.accountType === 'agency' ? '' : portfolio.agency?.name || '',
      agencyId: portfolio.agency?.name || '',
      organizationId: profile.agency?.agencyId || profile.agencyId || '',
      agencyRole: profile.agency?.agencyRole || '',
      showClosed: portfolio.showClosed !== false,
      defaultSort: portfolio.defaultSort || 'featured',
      featuredOrder: portfolio.featuredOrder || [],
      showTransactions: privacy.showTransactions !== false,
      isPublic: portfolio.isPublic !== false,
      searchable: portfolio.searchable !== false,
      since: member.createdAt,
      sample: false,
      demo: false,
    };
    memberBrokers.push(broker);
  }

  // Public agency pages can show only colleagues who belong to the same
  // agency and have not disabled public profile visibility.
  const agencyTeams = new Map<string, any[]>();
  for (const member of memberResult.docs as any[]) {
    const profile = member.profile && typeof member.profile === 'object' ? member.profile : {};
    const portfolio = profile.portfolio || {};
    const orgId = String(profile.agency?.agencyId || profile.agencyId || '');
    if (!orgId || profile.agency?.agencyRole !== 'agency_broker' || portfolio.isPublic === false) continue;
    const name = portfolio.displayName || member.name || 'Agency broker';
    const team = agencyTeams.get(orgId) || [];
    team.push({
      id: member.id,
      slug: portfolio.slug || undefined,
      name,
      initials: name.split(/\s+/).map((part: string) => part[0]).slice(0, 2).join('').toUpperCase(),
      title: portfolio.title || 'Real estate broker',
      photo: portfolio.photo || '',
      specialties: portfolio.specialties || [],
    });
    agencyTeams.set(orgId, team);
  }
  for (const agency of memberBrokers) {
    if (agency.type !== 'agency') continue;
    const orgId = String(agency.organizationId || '');
    if (orgId) agency.team = agencyTeams.get(orgId) || [];
  }

  // Published member listings come from the properties collection. The complete
  // editable listing is stored in appData with its owning member ID.
  const brokersByMemberId = new Map(memberBrokers.map((broker) => [String(broker.id), broker]));
  for (const doc of propertyResult.docs as any[]) {
    const listing = publicListing(listingFromProperty(doc));
    const ownerId = doc.appData?.ownerMemberId;
    if (!ownerId || listing.status !== 'published' || listing.display?.visible === false) continue;
    const broker = brokersByMemberId.get(String(ownerId));
    if (broker) {
      memberListings.push({ ...listing, brokerId: ownerId, broker, own: false });
      continue;
    }
    const ownerIdFromRelation = doc.ownerDeveloper?.id || doc.ownerDeveloper;
    const developer = developersById.get(String(ownerIdFromRelation || ownerId));
    if (developer && doc.ownerDirect && doc.claimable) {
      memberListings.push({ ...listing, brokerId: null, broker: null, ownerDirect: true, claimable: true, owner: developer, own: false });
    }
  }

  return {
    brokers: sampleBrokers,
    listings: [...sampleListings, ...memberListings],
    memberBrokers,
    plans: planResult.docs.filter((plan: any) => Boolean(PLAN_CATALOG[plan.slug])).map((plan: any) => ({
        id: plan.slug,
        name: plan.name,
        roleAudience: PLAN_CATALOG[plan.slug].roleAudience,
        audience: plan.audience || '',
        seats: plan.seats ?? null,
        listings: plan.listings ?? null,
        selections: plan.selections ?? 0,
        features: (plan.features || []).map((feature: any) => feature.feature).filter(Boolean),
        highlighted: Boolean(plan.highlighted),
    })),
  };
}, ['app-public-v1'], { revalidate: 60, tags: ['cms'] });

export async function GET() {
  return NextResponse.json(await loadPublicData(), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
