/*
 * Property search rules shared by the server (initial HTML, landing pages) and the browser (live
 * filtering), so both render the same results for the same URL.
 */
import { slugify } from './utils';

export const PAGE_SIZE = 24;

/** Price ceilings depend on the purpose; “All” has no ceiling (the select is disabled). */
export function maxOptions(purpose: string): [number | '', string][] {
  if (purpose === 'rent')
    return [
      ['', 'Any price'],
      [100000, 'Up to AED 100k /yr'],
      [200000, 'Up to AED 200k /yr'],
      [300000, 'Up to AED 300k /yr'],
      [1000000, 'Up to AED 1M /yr'],
    ];
  if (purpose === 'sale')
    return [
      ['', 'Any price'],
      [1500000, 'Up to AED 1.5M'],
      [2000000, 'Up to AED 2M'],
      [3000000, 'Up to AED 3M'],
      [5000000, 'Up to AED 5M'],
      [15000000, 'Up to AED 15M'],
      [50000000, 'Up to AED 50M'],
    ];
  return [['', 'Any price']];
}

const time = (l: any) => {
  const t = new Date(l.createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

export const SORTS: Record<string, (a: any, b: any) => number> = {
  newest: (a, b) => time(b) - time(a),
  featured: (a, b) =>
    (b.display?.portfolioFeatured ? 1 : 0) - (a.display?.portfolioFeatured ? 1 : 0) || time(b) - time(a),
  priceAsc: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
  priceDesc: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
};

export const URL_KEYS = ['purpose', 'q', 'type', 'completion', 'max', 'sort', 'page'] as const;

export type SearchFilters = {
  purpose: 'all' | 'sale' | 'rent';
  q: string;
  type: string;
  completion: string;
  max: string;
  sort: string;
  page: number;
};

type ParamReader = { get(key: string): string | null };

/** A `URLSearchParams`-like reader over the `searchParams` object a server page receives. */
export function paramReader(params: Record<string, string | string[] | undefined> = {}): ParamReader {
  return {
    get(key) {
      const value = params[key];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  };
}

/** Reads the filters from the URL (the source of truth), sanitising the price ceiling for the purpose. */
export function fromParams(sp: ParamReader): SearchFilters {
  const rawPurpose = sp.get('purpose');
  const purpose = rawPurpose === 'sale' || rawPurpose === 'rent' ? rawPurpose : 'all';
  const maxRaw = sp.get('max') || '';
  const max = maxOptions(purpose).some((x) => String(x[0]) === maxRaw) ? maxRaw : '';
  const sort = sp.get('sort') || '';
  const page = Math.floor(Number(sp.get('page')));
  return {
    purpose,
    q: sp.get('q') || '',
    type: sp.get('type') || '',
    completion: sp.get('completion') || '',
    max,
    sort: SORTS[sort] ? sort : 'newest',
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** Query string for a set of filters (defaults are left out so URLs stay canonical). */
export function filterQuery(f: Partial<SearchFilters>) {
  const url = new URLSearchParams();
  URL_KEYS.forEach((k) => {
    const v = f[k];
    if (!v || v === 'all' || (k === 'sort' && v === 'newest') || (k === 'page' && Number(v) <= 1)) return;
    url.set(k, String(v));
  });
  const s = url.toString();
  return s ? '?' + s : '';
}

/** Same rule as the client store's `isPublic`: published, visible, and the broker profile is public. */
export function isPublicListing(l: any) {
  return l?.status === 'published' && l.display?.visible !== false && (!l.broker || l.broker.isPublic !== false);
}

export function searchListings(list: any[], f: SearchFilters, beds = '') {
  const s = f.q.toLowerCase();
  return list
    .filter((n) => {
      if (!isPublicListing(n)) return false;
      if (f.purpose !== 'all' && n.purpose !== f.purpose) return false;
      if (f.type && n.type !== f.type) return false;
      if (f.completion && n.completion !== f.completion) return false;
      if (beds !== '') {
        const b = +beds;
        if (b >= 4 ? Number(n.beds) < 4 : Number(n.beds) !== b) return false;
      }
      if (f.max && Number(n.price) > +f.max) return false;
      if (
        s &&
        [n.title, n.area, n.emirate, n.type, n.building, n.broker?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .indexOf(s) < 0
      )
        return false;
      return true;
    })
    .sort(SORTS[f.sort] || SORTS.newest);
}

export function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function pageSlice<T>(items: T[], page: number) {
  const p = Math.min(Math.max(1, page), pageCount(items.length));
  return items.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
}

// ── Area landing pages ────────────────────────────────────────────────────────

export type LandingPurpose = 'sale' | 'rent';

export const areaSlug = (name: string) => slugify(name);

/** Plural, URL-friendly names for the property types that get their own landing pages. */
const TYPE_SLUGS: Record<string, string> = {
  Apartment: 'apartments',
  Villa: 'villas',
  Townhouse: 'townhouses',
  Penthouse: 'penthouses',
  Duplex: 'duplexes',
  'Hotel apartment': 'hotel-apartments',
  'Residential building': 'residential-buildings',
  Office: 'offices',
  'Shop / Retail': 'shops',
  Retail: 'retail',
  Showroom: 'showrooms',
  Warehouse: 'warehouses',
  'Commercial villa': 'commercial-villas',
  'Commercial building': 'commercial-buildings',
  Factory: 'factories',
  'Labour accommodation': 'labour-accommodation',
  'Residential plot': 'residential-plots',
  'Commercial plot': 'commercial-plots',
  'Industrial plot': 'industrial-plots',
  'Mixed-use plot': 'mixed-use-plots',
  Plot: 'plots',
};

export function typeSlug(type: string) {
  return TYPE_SLUGS[type] || slugify(type) + 's';
}

/** Plural label for headings: “Apartments”, “Shops”, “Residential plots”. */
export function typeLabel(type: string) {
  const slug = typeSlug(type);
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
}

/** `apartments-for-sale` → { type: 'Apartment', purpose: 'sale' }; `for-rent` → { purpose: 'rent' }. */
export function parseSegment(segment: string, types: string[]) {
  const m = /^(?:(.+)-)?for-(sale|rent)$/.exec(segment || '');
  if (!m) return null;
  const purpose = m[2] as LandingPurpose;
  if (!m[1]) return { type: '', purpose };
  const type = types.find((t) => typeSlug(t) === m[1]);
  return type ? { type, purpose } : null;
}

export function segmentFor(type: string, purpose: LandingPurpose) {
  return (type ? typeSlug(type) + '-' : '') + 'for-' + purpose;
}

/** Areas with at least one public listing, most listings first. */
export function listingAreas(list: any[]) {
  const areas = new Map<string, { name: string; slug: string; count: number }>();
  list.filter(isPublicListing).forEach((l) => {
    const name = String(l.area || '').trim();
    if (!name) return;
    const slug = areaSlug(name);
    const entry = areas.get(slug) || { name, slug, count: 0 };
    entry.count += 1;
    areas.set(slug, entry);
  });
  return [...areas.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Public listings in one area (matched by slug, so spelling and case variants group together). */
export function listingsInArea(list: any[], slug: string) {
  return list.filter((l) => isPublicListing(l) && l.area && areaSlug(l.area) === slug);
}

/** The type/purpose combinations that have listings in an area, for landing-page links and the sitemap. */
export function areaSegments(list: any[]) {
  const segments = new Map<string, { type: string; purpose: LandingPurpose; segment: string; count: number }>();
  list.filter(isPublicListing).forEach((l) => {
    const purpose: LandingPurpose = l.purpose === 'rent' ? 'rent' : 'sale';
    [segmentFor('', purpose), l.type ? segmentFor(l.type, purpose) : ''].filter(Boolean).forEach((segment, i) => {
      const entry = segments.get(segment) || { type: i ? l.type : '', purpose, segment, count: 0 };
      entry.count += 1;
      segments.set(segment, entry);
    });
  });
  return [...segments.values()].sort((a, b) => (a.type ? 1 : 0) - (b.type ? 1 : 0) || b.count - a.count);
}

/** Brokers (not agencies) who list an area among the areas they cover. */
export function brokersInArea(brokers: any[], slug: string) {
  return brokers.filter(
    (b) => b.type !== 'agency' && (b.areas || []).some((a: string) => areaSlug(a) === slug),
  );
}

/** Areas covered by at least one public broker, most brokers first. */
export function brokerAreas(brokers: any[]) {
  const areas = new Map<string, { name: string; slug: string; count: number }>();
  brokers
    .filter((b) => b.type !== 'agency')
    .forEach((b) =>
      new Set<string>((b.areas || []).map((a: string) => String(a).trim()).filter(Boolean)).forEach((name) => {
        const slug = areaSlug(name);
        const entry = areas.get(slug) || { name, slug, count: 0 };
        entry.count += 1;
        areas.set(slug, entry);
      }),
    );
  return [...areas.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
