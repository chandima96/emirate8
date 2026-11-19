import { unstable_cache as nextCache } from 'next/cache';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { loadPublicDataSafe } from '@/lib/server/publicData';
import { publicBrokers } from '@/lib/server/landing';
import { brokerFacts, brokerPath, propertyFacts, propertyPath } from '@/lib/seoAgent/facts';
import { hashFacts } from '@/lib/seoAgent/targets';
import { validateSeoDraft } from '@/lib/seoAgent/validate';

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

const toPageSeo = (row: any): PageSeo => ({
  title: String(row?.title || '').trim(),
  metaDescription: String(row?.metaDescription || '').trim(),
  faq: (Array.isArray(row?.faq) ? row.faq : [])
    .filter((f: any) => f?.question && f?.answer)
    .map((f: any) => ({ question: String(f.question).trim(), answer: String(f.answer).trim() })),
});

/** Admin-generated content (seo-content), only while the record still has the facts it was written from. */
async function adminContent(path: string, hash: string): Promise<PageSeo | null> {
  const row = await approvedRow(path);
  return row && row.sourceHash === hash ? toPageSeo(row) : null;
}

/**
 * The SEO content a property page shows:
 * 1. the listing's own `seo` (written in the editor, after autofill or with Generate SEO, and editable by
 *    the broker), when it still passes the validator against the listing's current facts. A changed price
 *    or size leaves an old number in it, so it stops showing until it is regenerated;
 * 2. otherwise approved content generated from Payload admin, while its fact hash still matches.
 */
export async function seoForProperty(slug: string) {
  const data = await loadPublicDataSafe();
  const listing = (data?.listings || []).find((l: any) => l.slug === slug || l.id === slug);
  if (!listing) return null;
  const brokers = new Map(publicBrokers(data).map((b: any) => [String(b.id), b]));
  const facts = propertyFacts(listing, brokers);
  if (listing.seo && typeof listing.seo === 'object') {
    const own = toPageSeo(listing.seo);
    if (!validateSeoDraft({ ...own, issues: [] }, facts).length) return own;
  }
  return adminContent(propertyPath(listing.slug || listing.id), hashFacts(facts));
}

export async function seoForBroker(slug: string) {
  const data = await loadPublicDataSafe();
  const broker = publicBrokers(data).find((b: any) => b.slug === slug);
  if (!broker || broker.type === 'agency') return null;
  return adminContent(brokerPath(broker.slug), hashFacts(brokerFacts(broker)));
}
