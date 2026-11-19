import { loadPublicDataSafe } from '@/lib/server/publicData';
import {
  SORTS,
  brokersInArea,
  isPublicListing,
  listingsInArea,
  pageCount,
  parseSegment,
  type LandingPurpose,
} from '@/lib/propertySearch';
import type { Landing } from '@/components/portal/AreaLanding';

/**
 * Public brokers as the agents directory lists them, each with `activeListings` counted from the public
 * listings (the client store's `brokerStats` has nothing to count from during server rendering).
 */
export function publicBrokers(data: any) {
  const counts = new Map<string, number>();
  (data?.listings || []).filter(isPublicListing).forEach((l: any) => {
    // Same link the client store's `listingsFor` uses.
    const id = String(l.brokerId ?? '');
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });
  return [...(data?.brokers || []), ...(data?.memberBrokers || [])]
    .filter((b: any) => b && b.slug && b.isPublic !== false && b.searchable !== false)
    .map((b: any) => ({ ...b, activeListings: counts.get(String(b.id)) || 0 }));
}

/** Data for /properties/[area] and /properties/[area]/[segment]; null when the page has no listings. */
export async function loadLanding(slug: string, segment: string | undefined, pageParam: unknown): Promise<Landing | null> {
  const data = await loadPublicDataSafe();
  const areaListings = listingsInArea(data?.listings || [], slug);
  if (!areaListings.length) return null;
  // The most common spelling of the area name in the listings.
  const names = new Map<string, number>();
  areaListings.forEach((l) => names.set(l.area.trim(), (names.get(l.area.trim()) || 0) + 1));
  const name = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];

  let type = '';
  let purpose: LandingPurpose | '' = '';
  if (segment) {
    const parsed = parseSegment(segment, [...new Set(areaListings.map((l) => l.type).filter(Boolean))]);
    if (!parsed) return null;
    ({ type, purpose } = parsed);
  }
  const listings = areaListings
    .filter((l) => (!purpose || (l.purpose === 'rent' ? 'rent' : 'sale') === purpose) && (!type || l.type === type))
    .sort(SORTS.newest);
  if (!listings.length) return null;
  const pages = pageCount(listings.length);
  const n = Math.floor(Number(pageParam));
  const page = Number.isFinite(n) && n > 1 ? Math.min(n, pages) : 1;
  return {
    area: { name, slug },
    type,
    purpose,
    areaListings,
    listings,
    page,
    pages,
    brokerCount: brokersInArea(publicBrokers(data), slug).length,
  };
}
