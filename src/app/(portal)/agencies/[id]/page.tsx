import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { BrokerPortfolio, BrokerPortfolioSkeleton } from '@/components/portal/BrokerPortfolio';
import { getAgency, getBrokers, getProperties } from '@/lib/cms';
import { listingFromProperty } from '@/lib/server/member-properties';
import { DEFAULT_AGENCY_COVER, listJoin, profileExtras } from '@/lib/brokerProfile';
import { brokerIdsOf } from '@/lib/propertyBrokers';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.emirate8.com').replace(/\/$/, '');

function decodeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function mediaUrl(media: any) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || (media.sourcePath ? `/images/${media.sourcePath}` : '');
}

function normalizeBroker(raw: any) {
  const profile = raw?.appData && typeof raw.appData === 'object' ? raw.appData : {};
  const portfolio = profile.portfolio && typeof profile.portfolio === 'object' ? profile.portfolio : {};
  const data = { ...profile, ...portfolio, ...raw };
  const name = data.name || 'Real estate broker';
  const agency = data.agency && typeof data.agency === 'object' ? data.agency : null;
  return {
    ...data,
    id: profile.ownerMemberId || data.id || raw.id,
    cmsId: raw.id,
    userId: profile.ownerMemberId || data.userId || raw.id,
    slug: data.slug,
    name,
    title: data.title || 'Real estate broker',
    photo: mediaUrl(data.photo),
    cover: mediaUrl(data.cover),
    initials: name
      .split(/\s+/)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    agency,
    agencyName: data.agencyName || agency?.name || '',
    independent: !(data.agencyName || agency?.name),
    areas: Array.isArray(data.areas) ? data.areas : [],
    languages: Array.isArray(data.languages) ? data.languages.map((item: any) => item.language || item) : [],
    specialties: Array.isArray(data.specialties) ? data.specialties.map((item: any) => item.specialty || item) : [],
    credentials: data.credentials || [],
    isPublic: portfolio.isPublic !== false && data.isPublic !== false,
    searchable: portfolio.searchable !== false && data.searchable !== false,
    brnVerified: raw.verified === true,
    contactMode: portfolio.contactMode === 'form' ? 'form' : 'all',
  };
}

function normalizeAgencyPortfolio(rawAgency: any, rawAccount: any, members: any[]) {
  const name = rawAgency.name || 'Real estate agency';
  const profile = rawAccount?.appData && typeof rawAccount.appData === 'object' ? rawAccount.appData : {};
  const portfolio = profile.portfolio && typeof profile.portfolio === 'object' ? profile.portfolio : {};
  const privacy = profile.privacy && typeof profile.privacy === 'object' ? profile.privacy : {};
  const extras = profileExtras(portfolio);
  // The agency's own service areas first; fall back to the team's areas when none are set.
  const areas = (portfolio.areas || []).length ? portfolio.areas : [...new Set(members.flatMap((broker) => broker.areas || []))];
  const credentials = profile.credentials && typeof profile.credentials === 'object' ? profile.credentials : {};
  const verified = rawAccount?.verified === true;
  return {
    ...extras,
    id: profile.ownerMemberId || rawAccount?.id || rawAgency.id,
    userId: profile.ownerMemberId || rawAccount?.id || rawAgency.id,
    cmsId: rawAccount?.id,
    slug: portfolio.slug || rawAccount?.slug || rawAgency.slug || String(rawAgency.id),
    type: 'agency',
    name,
    title: 'Real Estate Agency',
    photo: mediaUrl(rawAgency.logo) || mediaUrl(portfolio.photo) || mediaUrl(rawAccount?.photo),
    cover: mediaUrl(rawAgency.coverImage) || mediaUrl(portfolio.cover),
    coverPos: portfolio.coverPos ?? 50,
    bio: rawAgency.description || portfolio.bio || '',
    intro: portfolio.intro || '',
    headline: portfolio.headline || '',
    location: portfolio.location || rawAgency.location || '',
    preferred: portfolio.preferred || 'whatsapp',
    orn: rawAgency.licenseNumber || credentials.orn || '',
    ornVerified: verified && !!(rawAgency.licenseNumber || credentials.orn),
    tradeLicence: credentials.tradeLicence || '',
    tradeLicenceVerified: verified && !!credentials.tradeLicence,
    address: portfolio.address || rawAgency.address || '',
    certifications: extras.certifications.map((c: any) => ({ ...c, verified: !!c.verified && verified })),
    phone: rawAgency.phone || (privacy.showPhone === false ? '' : portfolio.publicPhone || ''),
    whatsapp: privacy.showWhatsapp === false ? '' : portfolio.whatsapp || '',
    email: rawAgency.email || (privacy.showEmail === false ? '' : portfolio.publicEmail || ''),
    website: extras.website || rawAgency.website || '',
    agency: { name, orn: rawAgency.licenseNumber || '', website: rawAgency.website || '' },
    initials: name
      .split(/\s+/)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    areas,
    languages: [],
    specialties: (portfolio.specialties || []).length ? portfolio.specialties : [...new Set(members.flatMap((broker) => broker.specialties || []))],
    credentials: [],
    team: members.map((broker) => ({
      id: broker.id,
      slug: broker.slug,
      name: broker.name,
      initials: broker.initials,
      title: broker.title,
      photo: broker.photo,
      specialties: broker.specialties,
      languages: broker.languages,
      areas: broker.areas,
      brnVerified: broker.brnVerified,
      contactMode: broker.contactMode,
      phone: broker.phone || '',
      email: broker.email || '',
      whatsapp: broker.whatsapp || '',
    })),
    showClosed: portfolio.showClosed !== false,
    defaultSort: extras.defaultSort,
    featuredOrder: portfolio.featuredOrder || [],
    showTransactions: privacy.showTransactions !== false,
    isPublic: portfolio.isPublic !== false,
    searchable: portfolio.searchable !== false,
    since: rawAccount?.createdAt || rawAgency.createdAt,
  };
}

function seo(a: any, path: string, activeCount: number) {
  const url = SITE + path;
  const title = `${a.name} | Real Estate Agency in Dubai | Emirate08`;
  const meta = a.areaMeta || {};
  const prim = (a.areas || []).filter((x: string) => meta[x]?.primary);
  const areas = (prim.length ? prim : a.areas || []).slice(0, 3);
  const specs = (a.specialties || []).slice(0, 2);
  let description =
    `${a.name} — real estate agency in Dubai` + (areas.length ? ' covering ' + listJoin(areas) : '') + '.' +
    (specs.length ? ' ' + listJoin(specs) + '.' : '') +
    (activeCount ? ` View ${activeCount} available propert${activeCount === 1 ? 'y' : 'ies'} and enquire.` : '');
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, '') + '…';
  const image = SITE + DEFAULT_AGENCY_COVER;
  const sameAs = (a.socials || []).map((s: any) => s.url).concat(a.website ? [a.website] : []);
  const org: any = {
    '@type': 'Organization', '@id': url + '#organization', name: a.name, url,
    description: a.intro || undefined, logo: a.photo ? (/^https?:/.test(a.photo) ? a.photo : SITE + a.photo) : undefined, image,
    foundingDate: a.founded || undefined, areaServed: (a.areas || []).map((x: string) => ({ '@type': 'Place', name: x })),
    knowsAbout: a.specialties, sameAs: sameAs.length ? sameAs : undefined,
  };
  if (a.contactMode !== 'form') {
    org.email = a.email || undefined;
    org.telephone = a.phone || undefined;
    if (a.address) org.address = { '@type': 'PostalAddress', streetAddress: a.address, addressLocality: 'Dubai', addressCountry: 'AE' };
  }
  const team = (a.team || []).filter((m: any) => a.teamMeta?.[m.id]?.visible !== false && m.brnVerified !== false);
  if (team.length) org.employee = team.map((m: any) => ({ '@type': 'Person', name: m.name, jobTitle: a.teamMeta?.[m.id]?.role || m.title || undefined, url: m.slug ? SITE + '/brokers/' + encodeURIComponent(m.slug) : undefined }));
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'ProfilePage', '@id': url, url, name: title, mainEntity: { '@id': url + '#organization' }, breadcrumb: { '@id': url + '#breadcrumb' } },
      org,
      { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [['Home', SITE + '/'], ['Agencies', SITE + '/agents'], [a.name, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
    ],
  };
  return { url, title, description, indexable: a.isPublic !== false && a.indexable !== false, image, jsonld };
}

async function load(id: string) {
  const agency = await getAgency(id);
  if (!agency) return null;
  const [brokers, properties] = await Promise.all([getBrokers(), getProperties({ limit: 500 })]);
  return { agency, brokers, properties };
}

export async function generateMetadata({ params }) {
  const id = decodeSlug((await params).id);
  const loaded = await load(id);
  if (!loaded) return { title: 'Agency not found', robots: { index: false, follow: false } };
  const { initialAgency, initialListings, path } = build(loaded, id);
  const s = seo(initialAgency, path, initialListings.filter((l: any) => l.status === 'published').length);
  return {
    title: { absolute: s.title },
    description: s.description,
    alternates: { canonical: s.url },
    robots: s.indexable ? { index: true, follow: true, 'max-image-preview': 'large' } : { index: false, follow: false },
    openGraph: { type: 'profile', siteName: 'Emirate08', title: s.title, description: s.description, url: s.url, images: [s.image] },
    twitter: { card: 'summary_large_image', title: s.title, description: s.description, images: [s.image] },
  };
}

function build({ agency, brokers, properties }: { agency: any; brokers: any[]; properties: any[] }, id: string) {
  const agencyAccount = brokers.find((broker: any) => {
    const relation = broker.agency;
    return (
      relation &&
      String(relation.id || relation) === String(agency.id) &&
      (broker.appData?.agency?.agencyRole === 'agency_admin' || String(broker.email || '').toLowerCase() === String(agency.email || '').toLowerCase())
    );
  });
  const members = brokers
    .filter((broker: any) => {
      const relation = broker.agency;
      const agencyRole = broker.appData?.agency?.agencyRole;
      return (
        relation &&
        String(relation.id || relation) === String(agency.id) &&
        agencyRole !== 'agency_admin' &&
        String(broker.id) !== String(agencyAccount?.id || '') &&
        broker.type !== 'agency'
      );
    })
    .map(normalizeBroker)
    .filter((broker: any) => broker.isPublic !== false && broker.searchable !== false);
  const memberById = new Map<string, any>();
  members.forEach((broker: any) => {
    memberById.set(String(broker.id), broker);
    memberById.set(String(broker.cmsId), broker);
  });
  const initialAgency = normalizeAgencyPortfolio(agency, agencyAccount, members);
  const initialListings = properties
    .map((property: any) => {
      const agencyOwner = property.ownerAgency;
      const ownedByAgency = String(agencyOwner?.id || agencyOwner || '') === String(agency.id);
      // Agency listings only: a team broker's own listings belong to the broker, not to the agency page.
      if (!ownedByAgency) return null;
      // The first of the property's brokers who is on this agency's team, if any.
      const broker = brokerIdsOf(property).map((id) => memberById.get(id)).find(Boolean);
      if (broker) return { ...listingFromProperty(property), broker, brokerId: broker.id };
      return { ...listingFromProperty(property), broker: initialAgency, brokerId: initialAgency.id };
    })
    .filter(Boolean);
  return { initialAgency, initialListings, path: `/agencies/${encodeURIComponent(agency.slug || id)}` };
}

export default async function AgencyPage({ params }) {
  const id = decodeSlug((await params).id);
  const loaded = await load(id);
  if (!loaded) notFound();
  const { initialAgency, initialListings, path } = build(loaded, id);
  const s = seo(initialAgency, path, initialListings.filter((l: any) => l.status === 'published').length);

  return (
    <>
      {initialAgency.isPublic !== false && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s.jsonld).replace(/</g, '\\u003c') }} />
      )}
      <Suspense fallback={<BrokerPortfolioSkeleton />}>
        <BrokerPortfolio initialBroker={initialAgency} initialListings={initialListings} profilePath={path} />
      </Suspense>
    </>
  );
}
