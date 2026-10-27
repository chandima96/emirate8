import { slugify } from '../utils';
import type { Payload } from 'payload';
import { isDeepStrictEqual } from 'node:util';

const STATUSES = new Set(['draft', 'pending', 'published', 'unpublished', 'sold', 'rented', 'archived']);
const PURPOSES = new Set(['sale', 'rent']);
const CATEGORIES = new Set(['residential', 'commercial', 'land']);
const TYPES = new Set([
  'Apartment',
  'Villa',
  'Townhouse',
  'Penthouse',
  'Duplex',
  'Office',
  'Retail',
  'Warehouse',
  'Plot',
  'Hotel apartment',
  'Residential building',
  'Shop / Retail',
  'Showroom',
  'Commercial villa',
  'Commercial building',
  'Factory',
  'Labour accommodation',
  'Residential plot',
  'Commercial plot',
  'Industrial plot',
  'Mixed-use plot',
]);
const COMPLETIONS = new Set(['ready', 'offplan']);
const EMIRATES = new Set(['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Umm Al Quwain', 'Fujairah']);

/** Use CMS columns for editable fields; appData supplies workspace-only metadata. */
export function listingFromProperty(doc: any) {
  const listing = { ...(doc.appData || {}), id: doc.appData?.id || String(doc.id) };
  for (const field of [
    'title',
    'slug',
    'ref',
    'status',
    'purpose',
    'category',
    'type',
    'completion',
    'emirate',
    'area',
    'community',
    'address',
    'coordinates',
    'price',
    'priceOnRequest',
    'size',
    'beds',
    'baths',
    'parking',
    'floor',
    'totalFloors',
    'description',
    'permit',
    'offplan',
    'display',
    'rent',
    'ownerType',
    'ownerDeveloper',
    'ownerAgency',
    'primaryBroker',
    'ownerDirect',
    'claimable',
    'claimPolicy',
    'createdAt',
    'updatedAt',
  ]) {
    if (doc[field] !== undefined) {
      listing[field] = ['ownerDeveloper', 'ownerAgency', 'primaryBroker'].includes(field)
        ? relationId(doc[field])
        : doc[field];
    }
  }
  // Merge the canonical permit group with appData so older records that do
  // not yet have the document relationship still retain their uploaded file.
  if (doc.permit || doc.appData?.permit) {
    listing.permit = { ...(doc.appData?.permit || {}), ...(doc.permit || {}) };
  }
  listing.highlights = (doc.highlights || []).map((item: any) => item.highlight);
  listing.amenities = (doc.amenities || []).map((item: any) => item.amenity);

  const mediaURL = (media: any) => {
    if (!media) return '';
    if (typeof media === 'string') return media;
    return media.url || (media.sourcePath ? `/images/${media.sourcePath}` : '');
  };
  const featured = mediaURL(doc.featuredImage);
  const gallery = (doc.photos || [])
    .map((item: any) => ({ src: mediaURL(item.image), caption: item.caption || '' }))
    .filter((item: any) => item.src);
  const storedImages = Array.isArray(listing.images) ? listing.images.filter(Boolean) : [];
  const storedPhotos = Array.isArray(listing.photos) ? listing.photos.filter((item: any) => item?.src) : [];
  const hasWorkspacePhotos = Boolean(doc.appData?.ownerMemberId) && Array.isArray(doc.appData?.photos);
  const imageSources = hasWorkspacePhotos
    ? storedPhotos.map((photo: any) => photo.src)
    : [
        featured,
        ...gallery.map((item: any) => item.src),
        ...storedImages,
        ...storedPhotos.map((item: any) => item.src),
      ].filter((src: string, index: number, all: string[]) => src && all.indexOf(src) === index);
  if (hasWorkspacePhotos) {
    listing.photos = storedPhotos;
    listing.featured = storedPhotos.some((photo: any) => photo.src === doc.appData.featured)
      ? doc.appData.featured
      : storedPhotos[0]?.src || '';
    listing.images = listing.featured
      ? [listing.featured, ...imageSources.filter((src: string) => src !== listing.featured)]
      : [];
    return listing;
  }
  if (featured) listing.featured = featured;
  else if (!listing.featured && imageSources[0]) listing.featured = imageSources[0];
  if (gallery.length)
    listing.photos = gallery.map((photo: any) => ({
      ...storedPhotos.find((stored: any) => stored.src === photo.src),
      ...photo,
    }));
  else if (!listing.photos?.length && storedPhotos.length) listing.photos = storedPhotos;
  listing.images = imageSources;
  return listing;
}

function numberOr(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function textOr(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
}

function dateOr(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function relationId(value: unknown) {
  const id = value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value;
  return typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;
}

function option(value: unknown, allowed: Set<string>, fallback: string) {
  return typeof value === 'string' && allowed.has(value) ? value : fallback;
}

function propertyData(listing: any, memberId: number) {
  const ownerDeveloper = relationId(listing.ownerDeveloper);
  const ownerAgency = relationId(listing.ownerAgency);
  const primaryBroker = relationId(listing.primaryBroker);
  const isDeveloperListing =
    listing.ownerType === 'developer' &&
    Boolean(ownerDeveloper || listing.ownerDirect !== undefined || listing.claimable !== undefined);
  const sourcePermit = listing.permit && typeof listing.permit === 'object' ? listing.permit : null;
  const permitDocument = sourcePermit?.document;
  const permitDocumentId =
    permitDocument && typeof permitDocument === 'object' ? permitDocument.id || permitDocument.mediaId : permitDocument;
  const appData = {
    ...listing,
    ownerMemberId: memberId,
    ...(sourcePermit
      ? {
          permit: {
            ...sourcePermit,
            // Keep the uploaded file metadata in the workspace snapshot as
            // well as the canonical Media relationship below.
            document: permitDocument || permitDocumentId,
          },
        }
      : {}),
  };
  const highlights = Array.isArray(listing.highlights)
    ? listing.highlights
        .map((value: any) => ({ highlight: textOr(value?.highlight ?? value) }))
        .filter((value: any) => value.highlight)
    : [];
  const amenities = Array.isArray(listing.amenities)
    ? listing.amenities
        .map((value: any) => ({ amenity: textOr(value?.amenity ?? value) }))
        .filter((value: any) => value.amenity)
    : [];

  return {
    title: textOr(listing.title, 'Untitled property'),
    appData,
    slug: textOr(listing.slug, textOr(listing.id, `member-${memberId}-${Date.now()}`)),
    ref: textOr(listing.ref) || null,
    status: option(listing.status, STATUSES, 'draft'),
    purpose: option(listing.purpose, PURPOSES, 'sale'),
    category: option(listing.category, CATEGORIES, 'residential'),
    type: option(listing.type, TYPES, 'Apartment'),
    completion: option(listing.completion, COMPLETIONS, 'ready'),
    emirate: option(listing.emirate, EMIRATES, 'Dubai'),
    area: textOr(listing.area, 'Dubai'),
    community: textOr(listing.community) || null,
    address: textOr(listing.address) || null,
    coordinates: listing.coordinates || undefined,
    price: numberOr(listing.price),
    priceOnRequest: Boolean(listing.priceOnRequest),
    size: listing.size == null ? null : numberOr(listing.size),
    beds: listing.beds == null ? null : numberOr(listing.beds),
    baths: listing.baths == null ? null : numberOr(listing.baths),
    parking: listing.parking == null ? null : numberOr(listing.parking),
    floor: listing.floor == null ? null : numberOr(listing.floor),
    totalFloors: listing.totalFloors == null ? null : numberOr(listing.totalFloors),
    description: textOr(listing.description) || null,
    ...(Array.isArray(listing.photos)
      ? {
          featuredImage:
            relationId(listing.photos.find((photo: any) => photo.src === listing.featured)?.mediaId) || null,
          photos: listing.photos
            .filter((photo: any) => photo.mediaId)
            .map((photo: any) => ({ image: relationId(photo.mediaId), caption: textOr(photo.caption) })),
        }
      : {}),
    highlights,
    amenities,
    permit: sourcePermit
      ? {
          number: textOr(sourcePermit.number) || undefined,
          expiry: dateOr(sourcePermit.expiry),
          document: permitDocumentId,
        }
      : undefined,
    offplan: listing.offplan || undefined,
    display: listing.display || undefined,
    rent: listing.rent || undefined,
    ...(listing.ownerType ? { ownerType: listing.ownerType } : {}),
    ...(ownerDeveloper ? { ownerDeveloper } : {}),
    ...(ownerAgency ? { ownerAgency } : {}),
    ...(isDeveloperListing
      ? { primaryBroker: primaryBroker || null, broker: primaryBroker || null }
      : primaryBroker
        ? { primaryBroker, broker: primaryBroker }
        : {}),
    ...(isDeveloperListing && listing.ownerDirect !== undefined ? { ownerDirect: Boolean(listing.ownerDirect) } : {}),
    ...(isDeveloperListing && listing.claimable !== undefined ? { claimable: Boolean(listing.claimable) } : {}),
    ...(isDeveloperListing && listing.claimPolicy ? { claimPolicy: listing.claimPolicy } : {}),
  };
}

/** Stable per-account draft URLs avoid collisions with other users and repeated titles. */
export function memberListingSlug(listing: any, memberId: number, match: any, occupied: Map<string, unknown>) {
  if (match?.slug && (listing.slugLocked || match.status === 'published' || match.appData?.slugLocked))
    return match.slug;
  const base = slugify(listing.title || listing.id);
  const identity = memberId + '-' + slugify(listing.id);
  const preferred = base + '-' + identity;
  let slug = preferred,
    suffix = 2;
  while (occupied.has(slug) && String(occupied.get(slug)) !== String(match?.id)) slug = preferred + '-' + suffix++;
  return slug;
}

/** Mirror every member listing into Payload's properties collection. */
export async function syncMemberProperties(payload: Payload, memberId: number, state: any) {
  if (!Array.isArray(state?.listings)) throw new Error('Workspace listings must be an array.');
  const listings = Array.isArray(state?.listings) ? state.listings : [];
  const existing = await payload.find({
    collection: 'properties',
    where: { 'appData.ownerMemberId': { equals: memberId } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const owned = existing.docs as any[];
  const ownedByListingId = new Map(owned.map((doc) => [String(doc.appData?.id), doc]));
  const candidateSlugs = listings
    .filter((listing: any) => listing && typeof listing === 'object' && listing.id)
    .map((listing: any) => memberListingSlug(listing, memberId, ownedByListingId.get(String(listing.id)), new Map()));
  const collisions = candidateSlugs.length
    ? await payload.find({
        collection: 'properties',
        where: { slug: { in: candidateSlugs } },
        limit: candidateSlugs.length,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] as any[] };
  const occupied = new Map<string, unknown>([
    ...owned.filter((doc) => doc.slug).map((doc) => [doc.slug, doc.id] as [string, unknown]),
    ...(collisions.docs as any[]).filter((doc) => doc.slug).map((doc) => [doc.slug, doc.id] as [string, unknown]),
  ]);
  const savedListings: { id: string; slug: string }[] = [];
  for (const listing of listings) {
    if (!listing || typeof listing !== 'object' || !listing.id) continue;
    const listingId = String(listing.id);
    const match = ownedByListingId.get(listingId);
    const slug = memberListingSlug(listing, memberId, match, occupied);
    const data = propertyData({ ...listing, slug }, memberId);
    occupied.set(slug, match?.id || 'new:' + listingId);
    const propertyFields = Object.keys(data).filter((field) => field !== 'appData' && field !== 'slug');
    if (
      match &&
      match.slug === slug &&
      isDeepStrictEqual(match.appData, data.appData) &&
      propertyFields.every((field) => isDeepStrictEqual(match[field] ?? null, (data as any)[field] ?? null))
    ) {
      savedListings.push({ id: listingId, slug });
      continue;
    }
    try {
      if (match) {
        await payload.update({ collection: 'properties', id: match.id, data: data as any, overrideAccess: true });
      } else {
        await payload.create({ collection: 'properties', data: data as any, overrideAccess: true });
      }
    } catch (error) {
      // Keep saving the listing when a deployment has not yet applied the
      // permit-document relationship migration. The uploaded Media ID remains
      // in appData, while number and expiry still save to the permit group.
      if (!data.permit?.document) throw error;
      const fallbackData = {
        ...data,
        permit: { number: data.permit.number, expiry: data.permit.expiry },
      };
      if (match) {
        await payload.update({
          collection: 'properties',
          id: match.id,
          data: fallbackData as any,
          overrideAccess: true,
        });
      } else {
        await payload.create({ collection: 'properties', data: fallbackData as any, overrideAccess: true });
      }
    }
    savedListings.push({ id: listingId, slug });
  }

  // Removing a workspace listing must also remove its canonical record.
  const ids = new Set(listings.map((listing: any) => String(listing.id)));
  for (const doc of owned) {
    if (!ids.has(String(doc.appData?.id))) {
      await payload.delete({ collection: 'properties', id: doc.id, overrideAccess: true });
    }
  }
  return savedListings;
}
