import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { BrokerPortfolio, BrokerPortfolioSkeleton } from '@/components/portal/BrokerPortfolio';
import { getAgency, getBrokers, getProperties } from '@/lib/cms';
import { listingFromProperty } from '@/lib/server/member-properties';

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
  };
}

function normalizeAgencyPortfolio(rawAgency: any, rawAccount: any, members: any[]) {
  const name = rawAgency.name || 'Real estate agency';
  const profile = rawAccount?.appData && typeof rawAccount.appData === 'object' ? rawAccount.appData : {};
  const portfolio = profile.portfolio && typeof profile.portfolio === 'object' ? profile.portfolio : {};
  const privacy = profile.privacy && typeof profile.privacy === 'object' ? profile.privacy : {};
  const areas = [...new Set([...members.flatMap((broker) => broker.areas || []), ...(portfolio.areas || [])])];
  return {
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
    location: rawAgency.location || portfolio.location || '',
    phone: rawAgency.phone || (privacy.showPhone === false ? '' : portfolio.publicPhone || ''),
    whatsapp: privacy.showWhatsapp === false ? '' : portfolio.whatsapp || '',
    email: rawAgency.email || (privacy.showEmail === false ? '' : portfolio.publicEmail || ''),
    website: rawAgency.website || '',
    agency: { name, orn: rawAgency.licenseNumber || '', website: rawAgency.website || '' },
    initials: name
      .split(/\s+/)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    areas,
    languages: [],
    specialties: portfolio.specialties || [],
    credentials: [],
    team: members.map((broker) => ({
      id: broker.id,
      slug: broker.slug,
      name: broker.name,
      initials: broker.initials,
      title: broker.title,
      photo: broker.photo,
      specialties: broker.specialties,
    })),
    showClosed: portfolio.showClosed !== false,
    defaultSort: portfolio.defaultSort || 'featured',
    featuredOrder: portfolio.featuredOrder || [],
    showTransactions: privacy.showTransactions !== false,
    isPublic: portfolio.isPublic !== false,
    searchable: portfolio.searchable !== false,
    since: rawAccount?.createdAt || rawAgency.createdAt,
  };
}

export async function generateMetadata({ params }) {
  const agency = await getAgency(decodeSlug((await params).id));
  if (!agency) return { title: 'Agency not found', robots: { index: false, follow: false } };
  return {
    title: `${agency.name} — UAE Real Estate Agency | Emirate08`,
    description:
      agency.description ||
      `${agency.name} real estate agency profile, brokers and current UAE property listings on Emirate08.`,
  };
}

export default async function AgencyPage({ params }) {
  const id = decodeSlug((await params).id);
  const agency = await getAgency(id);
  if (!agency) notFound();

  const [brokers, properties] = await Promise.all([getBrokers(), getProperties({ limit: 500 })]);
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
      const relation = property.primaryBroker || property.broker;
      const broker = relation && memberById.get(String(relation.id || relation));
      if (broker) return { ...listingFromProperty(property), broker, brokerId: broker.id };
      return ownedByAgency ? { ...listingFromProperty(property), broker: initialAgency, brokerId: initialAgency.id } : null;
    })
    .filter(Boolean);

  return (
    <Suspense fallback={<BrokerPortfolioSkeleton />}>
      <BrokerPortfolio
        initialBroker={initialAgency}
        initialListings={initialListings}
        profilePath={`/agencies/${encodeURIComponent(agency.slug || id)}`}
      />
    </Suspense>
  );
}
