import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { BrokerPortfolio, BrokerPortfolioSkeleton } from '@/components/portal/BrokerPortfolio';
import { getBroker, getProperties } from '@/lib/cms';
import { listingFromProperty } from '@/lib/server/member-properties';

const loading = <BrokerPortfolioSkeleton />;

function decodeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

export async function generateMetadata({ params }) {
  const broker = await getBroker(decodeSlug((await params).slug));
  if (!broker) return { title: 'Broker not found', robots: { index: false, follow: false } };
  const publicBroker = normalizeBroker(broker);
  return {
    title: `${publicBroker.name} — ${publicBroker.title} | Emirate08`,
    description:
      publicBroker.bio ||
      `${publicBroker.name} is a ${publicBroker.title.toLowerCase()} serving ${(publicBroker.areas || []).join(', ') || 'Dubai, UAE'}. View active properties and contact details on Emirate08.`,
  };
}

export default async function BrokerPage({ params }) {
  const slug = decodeSlug((await params).slug);
  const broker = await getBroker(slug);
  if (!broker) notFound();

  const publicBroker = normalizeBroker(broker);
  const properties = await getProperties({ limit: 500 });
  const initialListings = properties
    .filter((property: any) => {
      const relation = property.broker;
      return relation && String(relation.id || relation) === String(broker.id);
    })
    .map((property: any) => ({ ...listingFromProperty(property), broker: publicBroker, brokerId: publicBroker.id }));

  return (
    <Suspense fallback={loading}>
      <BrokerPortfolio initialBroker={publicBroker} initialListings={initialListings} />
    </Suspense>
  );
}
