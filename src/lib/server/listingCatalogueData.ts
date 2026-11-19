import { unstable_cache } from 'next/cache';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { buildCatalogue } from '@/lib/listingCatalogue';

/** Building catalogue built from published, publicly located listings; refreshed with the CMS cache.
 * Used by /api/listing-catalogue and by the listing autofill agent's find_building tool. */
export const loadCatalogue = unstable_cache(
  async () => {
    const payload = await getPayload({ config: await configPromise });
    const { docs } = await payload.find({
      collection: 'properties',
      where: {
        and: [{ status: { in: ['published', 'sold', 'rented'] } }, { 'display.visible': { not_equals: false } }],
      },
      sort: '-updatedAt',
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    });
    return buildCatalogue(docs);
  },
  ['listing-catalogue'],
  { tags: ['cms'], revalidate: 600 },
);
