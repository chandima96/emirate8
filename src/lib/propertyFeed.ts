/*
 * Property feed API — selection rules, the public property shape and query filtering.
 * Pure functions shared by the workspace UI, the feed routes and tests (no server imports).
 */
import { absoluteUrl } from './siteUrl';
import { mediaDisplayURL } from './mediaURL';

export const FEED_ID_LIMIT = 5000;
export const FEED_PAGE_LIMIT = 100;
export const FEED_DEFAULT_LIMIT = 25;
export const FEED_PATH = '/api/v1/feed/properties';

/**
 * Who can use the feed: independent brokers and agency admins (the agency's own account).
 * Brokers working inside an agency team (agencyRole "agency_broker") use their agency's feed instead.
 */
export function canUseFeedAccount(accountType: unknown, agencyRole: unknown) {
  if (accountType === 'broker') return true;
  return accountType === 'agency' && agencyRole !== 'agency_broker';
}

/**
 * autoIncludeNew on  → every published property except `excluded` (the default: everything starts selected).
 * autoIncludeNew off → only the `included` properties; newly published ones wait for the broker to add them.
 */
export type FeedConfig = { autoIncludeNew: boolean; excluded: string[]; included: string[] };
export type FeedChange =
  | { action: 'include' | 'exclude'; ids: string[] }
  | { action: 'settings'; autoIncludeNew: boolean }
  | { action: 'reset' };

export const DEFAULT_FEED: FeedConfig = { autoIncludeNew: true, excluded: [], included: [] };

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .filter((id) => (typeof id === 'string' || typeof id === 'number') && String(id).length <= 120)
    .map(String);
  return [...new Set(ids)].slice(0, FEED_ID_LIMIT);
}

export function normalizeFeedConfig(raw: any): FeedConfig {
  return {
    autoIncludeNew: raw?.autoIncludeNew !== false,
    excluded: idList(raw?.excluded),
    included: idList(raw?.included),
  };
}

export function isInFeed(config: FeedConfig, id: string | number) {
  const key = String(id);
  return config.autoIncludeNew ? !config.excluded.includes(key) : config.included.includes(key);
}

/** Validate a change sent by the workspace UI; null when it is malformed. */
export function readFeedChange(body: any): FeedChange | null {
  if (!body || typeof body !== 'object') return null;
  if (body.action === 'include' || body.action === 'exclude') {
    const ids = idList(body.ids);
    return ids.length ? { action: body.action, ids } : null;
  }
  if (body.action === 'settings' && typeof body.autoIncludeNew === 'boolean') {
    return { action: 'settings', autoIncludeNew: body.autoIncludeNew };
  }
  if (body.action === 'reset') return { action: 'reset' };
  return null;
}

/**
 * Apply a change. `publishedIds` is the current published inventory: switching modes converts one list
 * into the other so the feed's contents do not jump, and stale IDs of withdrawn listings are dropped.
 */
export function applyFeedChange(config: FeedConfig, change: FeedChange, publishedIds: string[]): FeedConfig {
  const published = new Set(publishedIds.map(String));
  const keep = (ids: string[]) => ids.filter((id) => published.has(id)).slice(0, FEED_ID_LIMIT);
  const current = normalizeFeedConfig(config);
  if (change.action === 'reset') return { ...DEFAULT_FEED };
  if (change.action === 'settings') {
    if (change.autoIncludeNew === current.autoIncludeNew) return current;
    if (change.autoIncludeNew) {
      const included = new Set(current.included);
      return { autoIncludeNew: true, included: [], excluded: keep([...published].filter((id) => !included.has(id))) };
    }
    const excluded = new Set(current.excluded);
    return { autoIncludeNew: false, excluded: [], included: keep([...published].filter((id) => !excluded.has(id))) };
  }
  const ids = new Set(change.ids);
  const add = (list: string[]) => keep([...new Set([...list, ...ids])]);
  const drop = (list: string[]) => keep(list.filter((id) => !ids.has(id)));
  if (current.autoIncludeNew) {
    return { ...current, excluded: change.action === 'exclude' ? add(current.excluded) : drop(current.excluded) };
  }
  return { ...current, included: change.action === 'include' ? add(current.included) : drop(current.included) };
}

/* ---------- Public API shape ---------- */

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value: unknown) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const url = (value: unknown) => {
  const src = text(value);
  return src ? absoluteUrl(mediaDisplayURL(src)) : null;
};

/** One broker from a property's broker list (public profile fields only). */
function feedBroker(profile: any) {
  return {
    name: text(profile.name),
    agency:
      profile.agencyRole === 'agency_broker'
        ? text(profile.currentAgency?.name) || text(profile.agencyName)
        : text(profile.agencyName) || (profile.type === 'agency' ? text(profile.name) : null),
    brn: text(profile.brnNumber) || text(profile.brn),
    phone: text(profile.phone),
    whatsapp: text(profile.whatsapp),
    email: text(profile.email),
    photo: url(profile.photo),
    profileUrl: profile.slug ? absoluteUrl('/brokers/' + encodeURIComponent(profile.slug)) : null,
  };
}

/** A stable, documented record for partner websites. Built only from already-public listing fields. */
export function toFeedProperty(listing: any) {
  const broker = listing.broker || null;
  const override = listing.contactOverride;
  const images = (Array.isArray(listing.photos) && listing.photos.length
    ? listing.photos.map((photo: any) => ({ url: url(photo?.src), caption: text(photo?.caption) }))
    : (listing.images || []).map((src: string) => ({ url: url(src), caption: null }))
  ).filter((image: any) => image.url);
  const featured = url(listing.featured) || images[0]?.url || null;
  const coordinates =
    num(listing.coordinates?.lat) !== null && num(listing.coordinates?.lng) !== null
      ? { lat: Number(listing.coordinates.lat), lng: Number(listing.coordinates.lng) }
      : null;
  const owner = listing.owner;

  return {
    id: String(listing.id),
    reference: text(listing.ref),
    slug: text(listing.slug),
    url: absoluteUrl('/property/' + encodeURIComponent(listing.slug || listing.id)),
    title: text(listing.title),
    purpose: listing.purpose === 'rent' ? 'rent' : 'sale',
    category: text(listing.category) || 'residential',
    type: text(listing.type),
    completion: listing.completion === 'offplan' ? 'offplan' : 'ready',
    price: {
      amount: listing.priceOnRequest ? null : num(listing.price),
      currency: 'AED',
      onRequest: Boolean(listing.priceOnRequest),
      frequency: listing.purpose === 'rent' ? listing.rent?.frequency || 'yearly' : null,
      previousAmount: listing.priceOnRequest ? null : num(listing.previousPrice),
    },
    bedrooms: num(listing.beds),
    bathrooms: num(listing.baths),
    parking: num(listing.parking),
    size: num(listing.size) !== null ? { value: Number(listing.size), unit: 'sqft' } : null,
    floor: num(listing.floor),
    location: {
      emirate: text(listing.emirate) || 'Dubai',
      area: text(listing.area),
      community: text(listing.community),
      address: text(listing.address),
      coordinates,
    },
    description: text(listing.description),
    highlights: (listing.highlights || []).filter((item: unknown) => text(item)),
    amenities: (listing.amenities || []).filter((item: unknown) => text(item)),
    featuredImage: featured,
    images,
    permit: listing.permit?.number
      ? { number: String(listing.permit.number), expiry: listing.permit.expiry || null, authority: listing.permit.authority || null }
      : null,
    offplan:
      listing.completion === 'offplan' && listing.offplan
        ? {
            developer: text(listing.offplan.developer),
            handover: text(listing.offplan.handover),
            paymentPlan: (listing.offplan.paymentPlan || [])
              .filter((step: any) => step && (step.label || step.percent))
              .map((step: any) => ({ label: text(step.label), percent: num(step.percent) })),
          }
        : null,
    contact: broker
      ? {
          // Team brokers have account type "agency" too; they are the contact, and their agency is named separately.
          kind: broker.type === 'agency' && broker.agencyRole !== 'agency_broker' ? 'agency' : 'broker',
          name: text(broker.name),
          agency:
            broker.agencyRole === 'agency_broker'
              ? text(broker.currentAgency?.name) || text(broker.agencyName)
              : text(broker.agencyName) || (broker.type === 'agency' ? text(broker.name) : null),
          brn: text(broker.brnNumber) || text(broker.brn),
          phone: text(override?.phone) || text(broker.phone),
          whatsapp: text(override?.whatsapp) || text(broker.whatsapp),
          email: text(override?.email) || text(broker.email),
          photo: url(broker.photo),
          profileUrl: broker.slug ? absoluteUrl('/brokers/' + encodeURIComponent(broker.slug)) : null,
        }
      : owner
        ? { kind: 'developer', name: text(owner.profile?.developer?.displayName) || text(owner.name), agency: null, brn: null, phone: null, whatsapp: null, email: null, photo: null, profileUrl: null }
        : null,
    // Up to 5 brokers represent the property; none of them is "primary". Order is display order.
    brokers: (Array.isArray(listing.brokerProfiles) ? listing.brokerProfiles : []).filter(Boolean).map(feedBroker),
    createdAt: listing.createdAt || null,
    updatedAt: listing.updatedAt || listing.createdAt || null,
  };
}

export type FeedProperty = ReturnType<typeof toFeedProperty>;

/* ---------- Query parameters ---------- */

const SORTS = {
  newest: (a: FeedProperty, b: FeedProperty) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '') || 0,
  updated: (a: FeedProperty, b: FeedProperty) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || '') || 0,
  price_asc: (a: FeedProperty, b: FeedProperty) => (a.price.amount ?? Infinity) - (b.price.amount ?? Infinity),
  price_desc: (a: FeedProperty, b: FeedProperty) => (b.price.amount ?? -Infinity) - (a.price.amount ?? -Infinity),
};

export type FeedQuery = ReturnType<typeof readFeedQuery>;

/** Parse the documented query string. Unknown values are reported, never silently treated as "any". */
export function readFeedQuery(params: URLSearchParams) {
  const errors: string[] = [];
  const list = (key: string) =>
    (params.get(key) || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  const number = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${key} must be a non-negative number.`);
      return null;
    }
    return value;
  };
  const purpose = params.get('purpose');
  if (purpose && !['sale', 'rent'].includes(purpose)) errors.push('purpose must be "sale" or "rent".');
  const completion = params.get('completion');
  if (completion && !['ready', 'offplan'].includes(completion)) errors.push('completion must be "ready" or "offplan".');
  const sort = params.get('sort') || 'newest';
  if (!(sort in SORTS)) errors.push(`sort must be one of ${Object.keys(SORTS).join(', ')}.`);
  const updatedSinceRaw = params.get('updatedSince');
  const updatedSince = updatedSinceRaw ? Date.parse(updatedSinceRaw) : null;
  if (updatedSinceRaw && !Number.isFinite(updatedSince)) errors.push('updatedSince must be an ISO 8601 date.');
  const page = number('page') ?? 1;
  const limit = number('limit') ?? FEED_DEFAULT_LIMIT;
  if (!Number.isInteger(page) || page < 1) errors.push('page must be a whole number from 1.');
  if (!Number.isInteger(limit) || limit < 1 || limit > FEED_PAGE_LIMIT) errors.push(`limit must be a whole number from 1 to ${FEED_PAGE_LIMIT}.`);

  return {
    errors,
    purpose: purpose as 'sale' | 'rent' | null,
    completion: completion as 'ready' | 'offplan' | null,
    category: params.get('category'),
    types: list('type').map((t) => t.toLowerCase()),
    emirate: params.get('emirate'),
    area: params.get('area'),
    q: params.get('q'),
    ids: list('ids'),
    minPrice: number('minPrice'),
    maxPrice: number('maxPrice'),
    minBeds: number('minBeds'),
    maxBeds: number('maxBeds'),
    updatedSince: updatedSince as number | null,
    sort: sort as keyof typeof SORTS,
    page,
    limit,
  };
}

const has = (value: string | null, needle: string | null) =>
  !needle || String(value || '').toLowerCase().includes(needle.trim().toLowerCase());

export function queryFeed(properties: FeedProperty[], query: FeedQuery) {
  const ids = new Set(query.ids);
  const filtered = properties.filter((p) => {
    if (ids.size && !ids.has(p.id) && !(p.reference && ids.has(p.reference))) return false;
    if (query.purpose && p.purpose !== query.purpose) return false;
    if (query.completion && p.completion !== query.completion) return false;
    if (query.category && p.category !== query.category) return false;
    if (query.types.length && !query.types.includes(String(p.type).toLowerCase())) return false;
    if (query.emirate && String(p.location.emirate).toLowerCase() !== query.emirate.toLowerCase()) return false;
    if (!has(p.location.area, query.area) && !has(p.location.community, query.area)) return false;
    if (query.q && !has([p.title, p.reference, p.location.area, p.location.community, p.type, p.description].join(' '), query.q)) return false;
    if (query.minPrice !== null && !(p.price.amount !== null && p.price.amount >= query.minPrice)) return false;
    if (query.maxPrice !== null && !(p.price.amount !== null && p.price.amount <= query.maxPrice)) return false;
    if (query.minBeds !== null && !(p.bedrooms !== null && p.bedrooms >= query.minBeds)) return false;
    if (query.maxBeds !== null && !(p.bedrooms !== null && p.bedrooms <= query.maxBeds)) return false;
    if (query.updatedSince !== null && !(Date.parse(p.updatedAt || '') >= query.updatedSince)) return false;
    return true;
  });
  filtered.sort(SORTS[query.sort]);
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / query.limit));
  const start = (query.page - 1) * query.limit;
  return { data: filtered.slice(start, start + query.limit), meta: { total, page: query.page, limit: query.limit, pages } };
}

/** Find one feed property by its ID, reference or slug. */
export function findFeedProperty(properties: FeedProperty[], key: string) {
  return properties.find((p) => p.id === key || p.reference === key || p.slug === key) || null;
}
