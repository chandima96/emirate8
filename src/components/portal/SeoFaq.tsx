import { jsonLdScript } from '@/lib/siteUrl';
import type { PageSeo } from '@/lib/server/seoContent';

/**
 * Reviewed FAQ for a property or broker page, shown on the page and as FAQPage structured data. The
 * same text is visible and in the markup, so the structured data never claims more than the page shows.
 */
export function SeoFaq({ seo, heading }: { seo: PageSeo | null; heading: string }) {
  if (!seo?.faq.length) return null;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seo.faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
  return (
    <section className="wrap pb-12" aria-labelledby="page-faq">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonld) }} />
      <h2 id="page-faq" className="h4">
        {heading}
      </h2>
      <dl className="mt-4 max-w-[760px] divide-y divide-line border-y border-line">
        {seo.faq.map((f) => (
          <div key={f.question} className="py-4">
            <dt className="text-[15px] font-semibold text-ink">{f.question}</dt>
            <dd className="mt-1.5 text-[14px] leading-[1.6] text-text">{f.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
