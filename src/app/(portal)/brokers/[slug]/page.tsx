import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { BrokerPortfolio, BrokerPortfolioSkeleton } from '@/components/portal/BrokerPortfolio';
import { getBroker, getProperties } from '@/lib/cms';
import { listingFromProperty } from '@/lib/server/member-properties';
import { DEFAULT_BROKER_COVER, listJoin, profileExtras } from '@/lib/brokerProfile';

const loading = <BrokerPortfolioSkeleton />;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.emirate8.com').replace(/\/$/, '');

function decodeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeBroker(raw: any) {
  const data = raw?.appData && typeof raw.appData === 'object' ? { ...raw.appData, ...raw } : raw;
  const membership = raw?.appData?.agency && typeof raw.appData.agency === 'object' ? raw.appData.agency : null;
  // Agency admins get the agency page; agency team brokers keep the broker profile.
  const agencyAccount = data.type === 'agency' || membership?.agencyRole === 'agency_admin';
  const name = data.name || 'Real estate broker';
  const agency = data.agency && typeof data.agency === 'object' ? data.agency : null;
  const portfolio = data.portfolio && typeof data.portfolio === 'object' ? data.portfolio : {};
  const extras = profileExtras(portfolio);
  const verified = data.verified === true;
  return {
    ...data,
    ...extras,
    type: agencyAccount ? 'agency' : data.type,
    agencyRole: membership?.agencyRole || '',
    id: data.id || raw.id,
    userId: data.userId || raw.id,
    slug: data.slug,
    name,
    title:
      agencyAccount && /broker/i.test(data.title || '')
        ? 'Real Estate Agency'
        : data.title || (agencyAccount ? 'Real Estate Agency' : 'Real estate broker'),
    initials: name
      .split(/\s+/)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    agency,
    agencyName: data.agencyName || agency?.name || '',
    independent: !(data.agencyName || agency?.name),
    currentAgency:
      membership?.agencyRole === 'agency_broker' && membership?.name
        ? { id: membership.agencyId, name: membership.name, slug: membership.slug || '' }
        : null,
    headline: portfolio.headline || data.headline || '',
    intro: portfolio.intro || data.intro || '',
    photo: portfolio.photo || data.photo || '',
    experience: portfolio.experience || data.experience || '',
    areas: Array.isArray(portfolio.areas) ? portfolio.areas : data.areas || [],
    languages: (Array.isArray(portfolio.languages) ? portfolio.languages : data.languages || []).map((x: any) => x?.language ?? x),
    specialties: (Array.isArray(portfolio.specialties) ? portfolio.specialties : data.specialties || []).map((x: any) => x?.specialty ?? x),
    credentials: data.credentials || [],
    certifications: extras.certifications.map((c: any) => ({ ...c, verified: !!c.verified && verified })),
    brnNumber: data.reraNumber || '',
    brnVerified: verified && !!data.reraNumber,
    preferred: portfolio.preferred || data.preferred || 'whatsapp',
    showClosed: portfolio.showClosed !== false,
    isPublic: portfolio.isPublic !== false && data.isPublic !== false,
    searchable: data.searchable !== false,
  };
}

/** Same title / description / robots rules as the reference page (one record, many outputs). */
function seo(b: any, activeCount: number) {
  const url = SITE + '/brokers/' + encodeURIComponent(b.slug);
  const title = `${b.name} | Real Estate Broker in Dubai | Emirate08`;
  const meta = b.areaMeta || {};
  const prim = (b.areas || []).filter((a: string) => meta[a]?.primary);
  const areas = (prim.length ? prim : b.areas || []).slice(0, 3);
  const specs = (b.specialties || []).slice(0, 2);
  let description =
    `${b.name} — ${(b.title || 'Real estate broker').toLowerCase()} in Dubai` +
    (areas.length ? ' covering ' + listJoin(areas) : '') +
    '.' +
    (specs.length ? ' ' + listJoin(specs) + '.' : '') +
    (activeCount ? ` View ${activeCount} available propert${activeCount === 1 ? 'y' : 'ies'} and enquire.` : '');
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, '') + '…';
  const indexable = b.isPublic !== false && b.indexable !== false;
  const image = /^https?:/.test(b.photo || '') ? b.photo : SITE + (b.photo && !/^data:/.test(b.photo) ? b.photo : DEFAULT_BROKER_COVER);
  const sameAs = (b.socials || []).map((s: any) => s.url).concat(b.website ? [b.website] : []);
  const contactAll = b.contactMode !== 'form';
  const person: any = {
    '@type': 'Person',
    '@id': url + '#person',
    name: b.name,
    url,
    jobTitle: b.title || undefined,
    description: b.intro || undefined,
    image: b.photo ? image : undefined,
    knowsLanguage: b.languages,
    areaServed: (b.areas || []).map((a: string) => ({ '@type': 'Place', name: a })),
    knowsAbout: b.specialties,
    sameAs: sameAs.length ? sameAs : undefined,
  };
  if (b.currentAgency) person.worksFor = { '@type': 'Organization', name: b.currentAgency.name };
  if (b.brnVerified)
    person.hasCredential = {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'license',
      name: 'RERA Broker Registration (BRN)',
      recognizedBy: { '@type': 'Organization', name: 'Dubai Land Department / RERA' },
    };
  if (contactAll) {
    person.email = b.email || undefined;
    person.telephone = b.phone || undefined;
  }
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'ProfilePage', '@id': url, url, name: title, dateModified: b.updatedAt || undefined, mainEntity: { '@id': url + '#person' }, breadcrumb: { '@id': url + '#breadcrumb' } },
      person,
      {
        '@type': 'BreadcrumbList',
        '@id': url + '#breadcrumb',
        itemListElement: [
          ['Home', SITE + '/'],
          ['Brokers', SITE + '/agents'],
          [b.name, url],
        ].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
      },
    ],
  };
  return { url, title, description, indexable, image, jsonld };
}

async function load(slug: string) {
  const broker = await getBroker(slug);
  if (!broker) return null;
  const publicBroker = normalizeBroker(broker);
  const properties = await getProperties({ limit: 500 });
  const initialListings = properties
    .filter((property: any) => {
      const relation = property.broker;
      return relation && String(relation.id || relation) === String(broker.id);
    })
    .map((property: any) => ({ ...listingFromProperty(property), broker: publicBroker, brokerId: publicBroker.id }));
  return { publicBroker, initialListings };
}

export async function generateMetadata({ params }) {
  const slug = decodeSlug((await params).slug);
  if (slug === 'me') return { title: 'My portfolio preview | Emirate08', robots: { index: false, follow: false } };
  const loaded = await load(slug);
  if (!loaded) return { title: 'Broker not found', robots: { index: false, follow: false } };
  const { publicBroker: b, initialListings } = loaded;
  if (b.type === 'agency') {
    return {
      title: `${b.name} — ${b.title} | Emirate08`,
      description: b.bio || `${b.name} on Emirate08. View active properties and contact details.`,
    };
  }
  const s = seo(b, initialListings.filter((l: any) => l.status === 'published').length);
  return {
    title: { absolute: s.title },
    description: s.description,
    alternates: { canonical: s.url },
    robots: s.indexable ? { index: true, follow: true, 'max-image-preview': 'large' } : { index: false, follow: false },
    openGraph: { type: 'profile', siteName: 'Emirate08', title: s.title, description: s.description, url: s.url, images: [s.image] },
    twitter: { card: 'summary_large_image', title: s.title, description: s.description, images: [s.image] },
  };
}

export default async function BrokerPage({ params }) {
  const slug = decodeSlug((await params).slug);
  // `me` is resolved from the signed-in browser session. It may have no public
  // CMS broker document yet, and draft previews must work before publication.
  if (slug === 'me') {
    return (
      <Suspense fallback={loading}>
        <BrokerPortfolio />
      </Suspense>
    );
  }
  const loaded = await load(slug);
  if (!loaded) notFound();
  const { publicBroker, initialListings } = loaded;
  const jsonld =
    publicBroker.type !== 'agency' && publicBroker.isPublic
      ? JSON.stringify(seo(publicBroker, initialListings.filter((l: any) => l.status === 'published').length).jsonld).replace(/</g, '\\u003c')
      : '';

  return (
    <>
      {jsonld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonld }} />}
      <Suspense fallback={loading}>
        <BrokerPortfolio initialBroker={publicBroker} initialListings={initialListings} />
      </Suspense>
    </>
  );
}
