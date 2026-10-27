import { notFound } from 'next/navigation';
import { AgencyProfile } from '@/components/portal/AgencyProfile';
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
  const data = raw?.appData && typeof raw.appData === 'object' ? { ...raw.appData, ...raw } : raw;
  const name = data.name || 'Real estate broker';
  const agency = data.agency && typeof data.agency === 'object' ? data.agency : null;
  return {
    ...data,
    id: data.id || raw.id,
    userId: data.userId || raw.id,
    slug: data.slug,
    name,
    title: data.title || 'Real estate broker',
    initials: name
      .split(/\s+/)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    agency,
    agencyName: data.agencyName || agency?.name || '',
    independent: !(data.agencyName || agency?.name),
    areas: data.areas || [],
    languages: data.languages || [],
    specialties: data.specialties || [],
    credentials: data.credentials || [],
    isPublic: data.isPublic !== false,
    searchable: data.searchable !== false,
  };
}

function normalizeAgency(raw: any, members: any[]) {
  const name = raw.name || 'Real estate agency';
  const areas = [...new Set(members.flatMap((broker) => broker.areas || []))];
  return {
    ...raw,
    id: raw.slug || String(raw.id),
    name,
    logo: mediaUrl(raw.logo),
    initials: name
      .split(/\s+/)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    orn: raw.licenseNumber || '',
    about:
      raw.description ||
      `${name} serves ${areas.join(', ') || 'Dubai, UAE'} through its brokers on Emirate08.`,
    areas,
    brokers: members.map((broker) => broker.id),
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
  const members = brokers
    .filter((broker: any) => {
      const relation = broker.agency;
      return relation && String(relation.id || relation) === String(agency.id);
    })
    .map(normalizeBroker)
    .filter((broker: any) => broker.isPublic !== false && broker.searchable !== false);
  const memberById = new Map(members.map((broker: any) => [String(broker.id), broker]));
  const initialListings = properties
    .map((property: any) => {
      const relation = property.broker;
      const broker = relation && memberById.get(String(relation.id || relation));
      return broker ? { ...listingFromProperty(property), broker, brokerId: broker.id } : null;
    })
    .filter(Boolean);
  const initialAgency = normalizeAgency(agency, members);

  return (
    <AgencyProfile
      id={initialAgency.id}
      initialAgency={initialAgency}
      initialMembers={members}
      initialListings={initialListings}
    />
  );
}
