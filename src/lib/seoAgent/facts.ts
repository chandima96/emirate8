/*
 * Fact sheets for the SEO content agent. Everything the agent may state comes from here, built only from
 * the public (already sanitised) listing and broker records. Safe to import in the browser (the listing
 * editor checks SEO content against them); hashing and page targets are in ./targets.ts (server).
 */
import { areaSlug, isPublicListing, typeLabel } from '../propertySearch';
import { TYPES } from '../../config/reference';

/** Bedrooms only mean something for homes; an office stored with beds 0 is not a studio. */
const isResidential = (l: any) =>
  l.category ? String(l.category).toLowerCase() === 'residential' : TYPES.residential.includes(l.type);

export type SeoKind = 'property' | 'broker';

export type SeoTarget = {
  kind: SeoKind;
  /** Public page path, also the stored content's key. */
  path: string;
  /** Area used for qualitative context (properties only). */
  area: string;
  facts: Record<string, unknown>;
  hash: string;
};

const clean = (value: unknown, max = 2000) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const list = (values: unknown, max = 25) =>
  (Array.isArray(values) ? values : [])
    .map((v) => clean(typeof v === 'object' && v ? (v as any).label || (v as any).name || '' : v, 120))
    .filter(Boolean)
    .slice(0, max);

/** Drops empty values so the model never sees "unknown" fields it might fill in. */
function compact(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  return out;
}

export const propertyPath = (slug: string) => '/property/' + encodeURIComponent(slug);
export const brokerPath = (slug: string) => '/brokers/' + encodeURIComponent(slug);

/** The facts a property's SEO content may draw on. Volatile fields (dates, counts) are left out. */
export function propertyFacts(l: any, brokersById: Map<string, any> = new Map()) {
  const broker = l.broker || brokersById.get(String(l.brokerId ?? '')) || null;
  const rent = l.purpose === 'rent';
  return compact({
    title: clean(l.title, 200),
    purpose: rent ? 'rent' : 'sale',
    propertyType: clean(l.type, 60),
    category: clean(l.category, 60),
    completion: l.completion === 'offplan' ? 'off-plan' : l.completion === 'ready' ? 'ready' : '',
    handover: clean(l.offplan?.handover || l.handover, 40),
    project: clean(l.offplan?.project, 120),
    emirate: clean(l.emirate || 'Dubai', 60),
    area: clean(l.area, 80),
    community: clean(l.community, 80),
    subcommunity: clean(l.subcommunity, 80),
    building: clean(l.building, 120),
    priceAED: !l.priceOnRequest && Number(l.price) > 0 ? Number(l.price) : undefined,
    priceBasis: !l.priceOnRequest && Number(l.price) > 0 ? (rent ? 'per year' : 'asking price') : undefined,
    priceOnRequest: l.priceOnRequest ? true : undefined,
    bedrooms: !isResidential(l)
      ? undefined
      : l.beds === 0 || l.beds === '0'
        ? 'studio'
        : Number(l.beds) > 0
          ? Number(l.beds)
          : undefined,
    bathrooms: Number(l.baths) > 0 ? Number(l.baths) : undefined,
    sizeSqft: Number(l.size) > 0 ? Number(l.size) : undefined,
    parkingSpaces: Number(l.parking) > 0 ? Number(l.parking) : undefined,
    floor: l.floor != null && l.floor !== '' ? clean(l.floor, 20) : clean(l.floorBand, 40),
    furnishing: clean(l.furnishing, 40),
    views: list(l.views, 10),
    amenities: list(l.amenities, 30),
    highlights: list(l.highlights, 12),
    description: clean(l.description, 3000),
    permit: l.permit?.number ? 'has an advertising permit number' : undefined,
    broker: broker?.name
      ? compact({
          name: clean(broker.name, 120),
          agency: clean(broker.agencyName, 120),
          reraRegistrationVerified: broker.brnVerified ? true : undefined,
        })
      : undefined,
  });
}

/** The facts a broker profile's SEO content may draw on. Listing counts are left out (they change daily). */
export function brokerFacts(b: any) {
  return compact({
    name: clean(b.name, 120),
    kind: b.type === 'agency' ? 'agency' : 'broker',
    jobTitle: clean(b.title, 120),
    agency: clean(b.agencyName || b.currentAgency?.name, 120),
    independent: b.type !== 'agency' && !(b.agencyName || b.currentAgency?.name) ? true : undefined,
    areasCovered: list(b.areas, 20),
    languages: list(b.languages, 12),
    specialties: list(b.specialties, 12),
    yearsExperience: Number(b.experience) > 0 ? Number(b.experience) : undefined,
    reraRegistrationVerified: b.brnVerified ? true : undefined,
    headline: clean(b.headline, 300),
    intro: clean(b.intro || b.bio, 2000),
    certifications: list((b.certifications || []).filter((c: any) => c?.verified).map((c: any) => c.label || c.name), 10),
  });
}

/**
 * Qualitative context about an area (no counts or prices, which change daily and would make stored
 * content wrong). The agent may describe the area with these words but not quote numbers from them.
 */
export function areaFacts(listings: any[], area: string) {
  const slug = areaSlug(area);
  const inArea = listings.filter((l) => isPublicListing(l) && l.area && areaSlug(l.area) === slug);
  if (!inArea.length) return null;
  const types = new Map<string, number>();
  inArea.forEach((l) => l.type && types.set(l.type, (types.get(l.type) || 0) + 1));
  return {
    area,
    commonPropertyTypes: [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => typeLabel(t).toLowerCase()),
    listedFor: [inArea.some((l) => l.purpose !== 'rent') && 'sale', inArea.some((l) => l.purpose === 'rent') && 'rent'].filter(Boolean),
    hasOffPlanListings: inArea.some((l) => l.completion === 'offplan'),
    areaPage: '/properties/' + slug,
  };
}
