import Link from 'next/link';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Pagination } from '@/components/portal/Pagination';
import { PAGE_SIZE, areaSegments, filterQuery, segmentFor, typeLabel, type LandingPurpose } from '@/lib/propertySearch';
import { absoluteUrl, jsonLdScript } from '@/lib/siteUrl';

const aed = (n: number) =>
  'AED ' +
  (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n));

export type Landing = {
  area: { name: string; slug: string };
  type: string;
  purpose: LandingPurpose | '';
  /** Every public listing in the area (all purposes and types), for the segment links. */
  areaListings: any[];
  /** The listings this page is about, sorted. */
  listings: any[];
  page: number;
  pages: number;
  brokerCount: number;
};

export function landingHeading({ area, type, purpose }: Pick<Landing, 'area' | 'type' | 'purpose'>) {
  const what = type ? typeLabel(type) : 'Properties';
  return purpose ? `${what} for ${purpose} in ${area.name}` : `Properties for sale and rent in ${area.name}`;
}

export function landingPath({ area, type, purpose }: Pick<Landing, 'area' | 'type' | 'purpose'>) {
  if (!purpose) return `/properties/${area.slug}`;
  return `/properties/${area.slug}/${segmentFor(type, purpose)}`;
}

/** Facts drawn only from the listings, so the intro never claims anything the data doesn't show. */
export function landingSummary(l: Landing) {
  const { listings, area, purpose } = l;
  const types = new Map<string, number>();
  listings.forEach((x) => x.type && types.set(x.type, (types.get(x.type) || 0) + 1));
  const topTypes = [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => typeLabel(t).toLowerCase());
  const offplan = listings.filter((x) => x.completion === 'offplan').length;
  // Sale prices and annual rents are never mixed in one range.
  const range = (which: LandingPurpose) => {
    const prices = listings
      .filter((x) => (x.purpose === 'rent' ? 'rent' : 'sale') === which)
      .map((x) => Number(x.price))
      .filter((n) => n > 0);
    if (!prices.length) return '';
    const [lo, hi] = [Math.min(...prices), Math.max(...prices)];
    const noun = which === 'rent' ? 'rents' : 'prices';
    const per = which === 'rent' ? ' a year' : '';
    return lo === hi ? `asking ${noun} of ${aed(lo)}${per}` : `asking ${noun} from ${aed(lo)} to ${aed(hi)}${per}`;
  };
  const sale = listings.filter((x) => x.purpose !== 'rent').length;
  const rent = listings.length - sale;
  let text = purpose
    ? `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'} for ${purpose} in ${area.name} on Emirate08` +
      (range(purpose) ? `, ${range(purpose)}.` : '.')
    : `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'} in ${area.name} on Emirate08: ` +
      [sale && `${sale} for sale${range('sale') ? ` (${range('sale')})` : ''}`, rent && `${rent} for rent${range('rent') ? ` (${range('rent')})` : ''}`]
        .filter(Boolean)
        .join(' and ') +
      '.';
  if (topTypes.length > 1) text += ` Mostly ${topTypes.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
  if (offplan) text += ` ${offplan} ${offplan === 1 ? 'is' : 'are'} off-plan.`;
  if (l.brokerCount) text += ` ${l.brokerCount} ${l.brokerCount === 1 ? 'broker on Emirate08 covers' : 'brokers on Emirate08 cover'} the area.`;
  return text;
}

export function AreaLanding(l: Landing) {
  const { area, type, purpose, listings, page, pages } = l;
  const path = landingPath(l);
  const shown = listings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const segments = areaSegments(l.areaListings);
  const h1 = landingHeading(l);
  const crumbs: [string, string][] = [
    ['Home', '/'],
    ['Properties', '/properties'],
    [area.name, `/properties/${area.slug}`],
    ...(purpose ? ([[h1, path]] as [string, string][]) : []),
  ];
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: h1,
      url: absoluteUrl(path),
      about: { '@type': 'Place', name: area.name, address: { '@type': 'PostalAddress', addressLocality: area.name, addressCountry: 'AE' } },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: listings.length,
        itemListElement: shown.map((x, i) => ({
          '@type': 'ListItem',
          position: (page - 1) * PAGE_SIZE + i + 1,
          url: absoluteUrl('/property/' + encodeURIComponent(x.slug || x.id)),
          name: x.title,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absoluteUrl(href) })),
    },
  ];
  const refine = '/properties' + filterQuery({ q: area.name, purpose: purpose || 'all', type });

  return (
    <div className="wrap py-8 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonld) }} />
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
        <ol className="flex flex-wrap gap-1.5">
          {crumbs.map(([name, href], i) => (
            <li key={href} className="flex gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === crumbs.length - 1 ? (
                <span aria-current="page">{name}</span>
              ) : (
                <Link href={href} className="hover:underline">
                  {name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="h2 mt-4">{h1}</h1>
      <p className="lead mt-3 max-w-[760px]">{landingSummary(l)}</p>

      {segments.length > 1 && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label={`Browse ${area.name} by type`}>
          {segments.map((s) => {
            const href = landingPath({ area, type: s.type, purpose: s.purpose });
            const current = href === path;
            return (
              <li key={s.segment}>
                <Link
                  href={href}
                  aria-current={current ? 'page' : undefined}
                  className={'chip px-3 py-1.5 text-[12px] hover:border-ink' + (current ? ' border-ink font-semibold' : '')}
                >
                  {landingHeading({ area, type: s.type, purpose: s.purpose }).replace(` in ${area.name}`, '')} ({s.count})
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {shown.map((x) => (
          <PropertyCard key={x.id} listing={x} />
        ))}
      </div>
      <Pagination path={path} page={page} pages={pages} className="mt-8" />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={refine} className="btn btn-outline btn-sm">
          Refine this search
        </Link>
        {l.brokerCount > 0 && (
          <Link href={`/agents/${area.slug}`} className="btn btn-ghost btn-sm">
            Real estate agents in {area.name}
          </Link>
        )}
      </div>
    </div>
  );
}
