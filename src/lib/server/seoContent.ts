import { unstable_cache as nextCache } from 'next/cache';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { loadPublicDataSafe } from '@/lib/server/publicData';
import { publicBrokers } from '@/lib/server/landing';
import { brokerFacts, brokerPath, hashFacts, propertyFacts, propertyPath } from '@/lib/seoAgent/facts';

export type PageSeo = {
  title: string;
  metaDescription: string;
  faq: { question: string; answer: string }[];
};

const approvedRow = nextCache(
  async (path: string) => {
    try {
      const payload = await getPayload({ config: await configPromise });
      const { docs } = await payload.find({
        collection: 'seo-content',
        where: { and: [{ path: { equals: path } }, { status: { equals: 'approved' } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      return (docs[0] as any) || null;
    } catch (error) {
      // Before the seo_content migration has run, pages simply have no agent content.
      console.error('[seo-content] lookup failed:', error instanceof Error ? error.message : error);
      return null;
    }
  },
  ['seo-content-approved'],
  { tags: ['cms'], revalidate: 300 },
);

/** Approved agent content for a page, but only while the record still has the facts it was written from. */
async function contentFor(path: string, hash: string): Promise<PageSeo | null> {
  const row = await approvedRow(path);
  if (!row || row.sourceHash !== hash) return null;
  return {
    title: String(row.title || ''),
    metaDescription: String(row.metaDescription || ''),
    faq: (Array.isArray(row.faq) ? row.faq : []).filter((f: any) => f?.question && f?.answer),
  };
}

export async function seoForProperty(slug: string) {
  const data = await loadPublicDataSafe();
  const listing = (data?.listings || []).find((l: any) => l.slug === slug || l.id === slug);
  if (!listing) return null;
  const brokers = new Map(publicBrokers(data).map((b: any) => [String(b.id), b]));
  return contentFor(propertyPath(listing.slug || listing.id), hashFacts(propertyFacts(listing, brokers)));
}

export async function seoForBroker(slug: string) {
  const data = await loadPublicDataSafe();
  const broker = publicBrokers(data).find((b: any) => b.slug === slug);
  if (!broker || broker.type === 'agency') return null;
  return contentFor(brokerPath(broker.slug), hashFacts(brokerFacts(broker)));
}
