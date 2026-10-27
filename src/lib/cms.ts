import { publicListing } from './publicListing';
/**
 * cms.ts — Payload Local API wrapper for server components.
 *
 * Uses Next.js unstable_cache so each request is deduped and cached under the
 * "cms" tag. Revalidate the cache by calling:
 *   revalidateTag('cms')
 * (e.g. from a Payload afterChange/afterDelete hook, or manually from an API route).
 *
 * Every exported function falls back gracefully to null / [] when the DB is
 * unreachable, so builds and previews never break.
 */
import { unstable_cache as nextCache } from 'next/cache';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

// ── Singleton ─────────────────────────────────────────────────────────────────

async function getPayloadClient() {
  const config = await configPromise;
  return getPayload({ config });
}

// ── Cache TTL ─────────────────────────────────────────────────────────────────
const REVALIDATE = 60; // seconds

// ── Properties ────────────────────────────────────────────────────────────────

/** Fetch all published properties (used on the browse / network pages). */
export const getProperties = nextCache(
  async (opts: { purpose?: 'sale' | 'rent'; limit?: number } = {}) => {
    try {
      const payload = await getPayloadClient();
      const where: Record<string, unknown> = {
        status: { equals: 'published' },
        'display.visible': { not_equals: false },
      };
      if (opts.purpose) where.purpose = { equals: opts.purpose };
      const { docs } = await payload.find({
        collection: 'properties',
        where,
        limit: opts.limit ?? 100,
        sort: '-updatedAt',
        depth: 2,
      });
      return docs.filter((property: any) => {
        const publicData = { ...property, ...(property?.appData || {}) };
        return publicData.slug && publicData.isPublic !== false && publicData.searchable !== false;
      }).map(publicListing);
    } catch (err) {
      console.error('[cms] getProperties error:', err);
      return [];
    }
  },
  ['cms-properties'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

/** Fetch a single property by slug. */
export const getProperty = nextCache(
  async (slug: string) => {
    try {
      const payload = await getPayloadClient();
      const { docs } = await payload.find({
        collection: 'properties',
        where: {
          and: [
            { slug: { equals: slug } },
            { status: { equals: 'published' } },
            { 'display.visible': { not_equals: false } },
          ],
        },
        limit: 1,
        depth: 2,
      });
      return docs[0] ? publicListing(docs[0]) : null;
    } catch (err) {
      console.error('[cms] getProperty error:', err);
      return null;
    }
  },
  ['cms-property'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

// ── Brokers ───────────────────────────────────────────────────────────────────

/** Fetch all brokers. */
export const getBrokers = nextCache(
  async () => {
    try {
      const payload = await getPayloadClient();
      const { docs } = await payload.find({
        collection: 'brokers',
        limit: 200,
        sort: '-featured,name',
        depth: 1,
      });
      return docs;
    } catch (err) {
      console.error('[cms] getBrokers error:', err);
      return [];
    }
  },
  ['cms-brokers'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

/** Fetch a single broker by slug. */
export const getBroker = nextCache(
  async (slug: string) => {
    try {
      const payload = await getPayloadClient();
      const { docs } = await payload.find({
        collection: 'brokers',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 2,
      });
      const broker = docs[0] as any;
      return broker?.appData?.isPublic === false || broker?.appData?.searchable === false ? null : broker ?? null;
    } catch (err) {
      console.error('[cms] getBroker error:', err);
      return null;
    }
  },
  ['cms-broker'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

// ── Agencies ──────────────────────────────────────────────────────────────────

export const getAgencies = nextCache(
  async () => {
    try {
      const payload = await getPayloadClient();
      const { docs } = await payload.find({
        collection: 'agencies',
        limit: 200,
        sort: '-featured,name',
        depth: 1,
      });
      return docs;
    } catch (err) {
      console.error('[cms] getAgencies error:', err);
      return [];
    }
  },
  ['cms-agencies'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

export const getAgency = nextCache(
  async (slug: string) => {
    try {
      const payload = await getPayloadClient();
      const { docs } = await payload.find({
        collection: 'agencies',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 2,
      });
      return docs[0] ?? null;
    } catch (err) {
      console.error('[cms] getAgency error:', err);
      return null;
    }
  },
  ['cms-agency'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

function publicDeveloperSlug(member: any) {
  const configured = member.profile?.developer?.slug;
  if (configured) return configured;
  return String(member.name || `developer-${member.id}`)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `developer-${member.id}`;
}

export const getDevelopers = nextCache(
  async () => {
    try {
      const payload = await getPayloadClient();
      const { docs } = await payload.find({
        collection: 'members',
        where: { accountType: { equals: 'developer' } },
        limit: 200,
        depth: 0,
      });
      return (docs as any[])
        .filter((member) => member.credentialStatus !== 'rejected' && member.profile?.developer?.public !== false)
        .map((member) => ({ id: member.id, name: member.name, slug: publicDeveloperSlug(member), profile: member.profile || {} }));
    } catch (err) {
      console.error('[cms] getDevelopers error:', err);
      return [];
    }
  },
  ['cms-developers'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

export const getDeveloper = nextCache(
  async (slug: string) => {
    try {
      const developers = await getDevelopers();
      const developer = developers.find((item) => item.slug === slug);
      if (!developer) return null;
      const payload = await getPayloadClient();
      const { docs: properties } = await payload.find({
        collection: 'properties',
        where: {
          and: [
            { ownerDeveloper: { equals: developer.id } },
            { status: { equals: 'published' } },
            { 'display.visible': { not_equals: false } },
          ],
        },
        limit: 200,
        sort: '-updatedAt',
        depth: 2,
      });
      return { ...developer, properties };
    } catch (err) {
      console.error('[cms] getDeveloper error:', err);
      return null;
    }
  },
  ['cms-developer'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

// ── Plans ─────────────────────────────────────────────────────────────────────

export const getPlans = nextCache(
  async () => {
    try {
      const payload = await getPayloadClient();
      const { docs } = await payload.find({
        collection: 'plans',
        limit: 20,
        sort: 'sortOrder',
        depth: 0,
      });
      return docs;
    } catch (err) {
      console.error('[cms] getPlans error:', err);
      return [];
    }
  },
  ['cms-plans'],
  { tags: ['cms'], revalidate: REVALIDATE },
);

// ── Cache revalidation helper ──────────────────────────────────────────────────

/** Call this from a route handler or Payload hook to bust all CMS caches. */
export async function revalidateCms() {
  const { revalidateTag } = await import('next/cache');
  revalidateTag('cms', 'max');
}
