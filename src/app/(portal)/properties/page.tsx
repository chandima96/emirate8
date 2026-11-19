import Link from 'next/link';
import { PropertySearch } from '@/components/portal/PropertySearch';
import { loadPublicDataSafe } from '@/lib/server/publicData';
import { PAGE_SIZE, filterQuery, fromParams, listingAreas, pageCount, pageSlice, paramReader, searchListings } from '@/lib/propertySearch';
import { absoluteUrl, jsonLdScript } from '@/lib/siteUrl';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function results(searchParams: Props['searchParams']) {
  const f = fromParams(paramReader(await searchParams));
  const data = await loadPublicDataSafe();
  const listings: any[] = data?.listings || [];
  const all = searchListings(listings, f);
  const pages = pageCount(all.length);
  const page = Math.min(f.page, pages);
  return { f: { ...f, page }, all, page, pages, items: pageSlice(all, page), areas: listingAreas(listings) };
}

function heading(f: { purpose: string; q: string }) {
  const what = f.purpose === 'rent' ? 'Properties for rent' : f.purpose === 'sale' ? 'Properties for sale' : 'Properties for sale and rent';
  return `${what} in ${f.q || 'Dubai and the UAE'}`;
}

export async function generateMetadata({ searchParams }: Props) {
  const { f, page, all } = await results(searchParams);
  // Purpose and page are the only filters with their own indexable URL; the rest are search facets.
  const canonical = '/properties' + filterQuery({ purpose: f.purpose, page });
  const faceted = Boolean(f.q || f.type || f.completion || f.max || f.sort !== 'newest');
  const title = heading(f) + (page > 1 ? ` – page ${page}` : '');
  const description =
    `Browse ${all.length} ${f.purpose === 'rent' ? 'rental ' : ''}propert${all.length === 1 ? 'y' : 'ies'}` +
    `${f.purpose === 'sale' ? ' for sale' : ''} in ${f.q || 'Dubai and the UAE'} from licensed brokers. ` +
    'Filter by type, bedrooms, completion and price, and contact the listing broker directly.';
  return {
    title,
    description,
    alternates: { canonical },
    robots: faceted ? { index: false, follow: true } : { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: { type: 'website', siteName: 'Emirate08', title, description, url: absoluteUrl(canonical) },
  };
}

export default async function PropertiesPage({ searchParams }: Props) {
  const { f, all, items, page, areas } = await results(searchParams);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: heading(f),
    numberOfItems: all.length,
    itemListElement: items.map((l, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + i + 1,
      url: absoluteUrl('/property/' + encodeURIComponent(l.slug || l.id)),
      name: l.title,
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonld) }} />
      {/* No Suspense boundary: the page renders per request (it reads searchParams), so the results go
          straight into the HTML instead of a hidden streamed chunk that crawlers without JavaScript skip. */}
      <PropertySearch initialListings={items} initialTotal={all.length} />
      {areas.length > 0 && (
        <section className="wrap pb-14" aria-labelledby="areas-title">
          <h2 id="areas-title" className="h4">
            Browse properties by area
          </h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((a) => (
              <li key={a.slug}>
                <Link href={`/properties/${a.slug}`} className="hover:underline">
                  Properties in {a.name}
                </Link>{' '}
                <span className="text-muted">({a.count})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
