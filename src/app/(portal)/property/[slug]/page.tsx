import { notFound } from 'next/navigation';
import { PropertyDetail } from '@/components/property/PropertyDetail';
import { listingFromProperty } from '@/lib/server/member-properties';
import { getProperty } from '@/lib/cms';
import { listingJsonLd } from '@/lib/listingJsonLd';
import { SITE_NAME, absoluteUrl, jsonLdScript, metaDescription } from '@/lib/siteUrl';

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

/** Normalize a Payload broker relation to the public broker shape used by property detail components. */
function brokerFromProperty(doc: any) {
  const raw = doc?.primaryBroker || doc?.broker;
  if (!raw || typeof raw !== 'object') return null;
  const data = raw.appData && typeof raw.appData === 'object' ? { ...raw.appData, ...raw } : raw;
  const name = data.name || 'Listing broker';
  const agency = data.agency && typeof data.agency === 'object' ? data.agency : null;
  return {
    ...data,
    id: data.id || raw.id,
    userId: data.userId || raw.id,
    slug: data.slug,
    name,
    title: data.title || 'Real estate broker',
    photo: mediaUrl(data.photo),
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
  const { slug } = await params;
  const property = await getProperty(decodeSlug(slug));
  if (!property) {
    return {
      title: 'Property not found',
      robots: { index: false, follow: false },
    };
  }
  const location = [property.community, property.area, property.emirate].filter(Boolean).join(', ');
  const purpose = property.purpose === 'rent' ? 'for rent' : 'for sale';
  const title = `${property.title} ${purpose} in ${location || 'the UAE'}`;
  const description = metaDescription(
    property.description ||
      `${property.type || 'Property'} ${purpose} in ${location || 'the UAE'}. View photos, price, key facts, amenities and the listing broker on Emirate08.`,
  );
  const url = absoluteUrl('/property/' + encodeURIComponent(property.slug || slug));
  // Photos as the page shows them (the raw record keeps them elsewhere). Data URLs can't be fetched by
  // crawlers or link previews.
  const listing = listingFromProperty(property);
  const images = [...new Set([listing.featured, ...(listing.images || [])].map((src: any) => (typeof src === 'string' ? src : src?.src || '')))]
    .filter((src: string) => src && !/^data:/.test(src))
    .slice(0, 4)
    .map(absoluteUrl);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url, ...(images.length ? { images } : {}) },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title, description, ...(images.length ? { images } : {}) },
  };
}

export default async function PropertyPage({ params }) {
  const { slug } = await params;
  const property = await getProperty(decodeSlug(slug));
  if (!property) notFound();

  const listing = listingFromProperty(property);
  listing.broker = brokerFromProperty(property);

  const jsonld = jsonLdScript(listingJsonLd(listing));
  return (
    <div className="wrap py-5 sm:py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonld }} />
      <PropertyDetail listing={listing} />
    </div>
  );
}
