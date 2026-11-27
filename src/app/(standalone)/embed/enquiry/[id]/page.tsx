import { EmbedEnquiryForm, type EmbedProperty } from '@/components/embed/EmbedEnquiryForm';
import { toFeedProperty } from '@/lib/propertyFeed';
import { resolveEmbed } from '@/lib/server/propertyFeed';

/*
 * Enquiry form that partner websites embed for each property of their feed (`enquiry.embedHtml` in the
 * property feed API). No site chrome: it is rendered inside the partner's iframe. The link is signed
 * per feed and property (src/lib/server/propertyFeed.ts), so the enquiry is credited to that feed.
 * Framing by any site is allowed for /embed/* only (next.config.mjs).
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Property enquiry',
  robots: { index: false, follow: false },
};

function priceText(price: ReturnType<typeof toFeedProperty>['price']) {
  if (price.onRequest || price.amount === null) return 'Price on request';
  const amount = new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(price.amount);
  return `AED ${amount}${price.frequency ? ` / ${price.frequency.replace(/ly$/, '')}` : ''}`;
}

export default async function EmbedEnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const feedId = typeof query.f === 'string' ? query.f : '';
  const token = typeof query.t === 'string' ? query.t : '';
  const propertyId = decodeURIComponent(id);
  const embed = await resolveEmbed(feedId, propertyId, token);

  if (!embed) {
    return (
      <main id="main" className="p-3">
        <div className="mx-auto max-w-[560px] rounded-xl border border-line bg-white p-6 text-center">
          <p className="font-display text-[15px] font-semibold text-ink">This property is no longer available</p>
          <p className="mt-1 text-[13px] text-muted">It may have been sold, rented or withdrawn.</p>
        </div>
      </main>
    );
  }

  const p = toFeedProperty(embed.listing);
  const property: EmbedProperty = {
    id: p.id,
    title: p.title || 'Property',
    reference: p.reference || '',
    area: [p.location.area, p.location.emirate].filter(Boolean).join(', '),
    price: priceText(p.price),
    image: p.featuredImage,
    url: p.url,
    contactName: p.contact?.name || '',
  };

  return (
    <main id="main" className="p-3">
      <EmbedEnquiryForm property={property} feedId={feedId} token={token} />
    </main>
  );
}
