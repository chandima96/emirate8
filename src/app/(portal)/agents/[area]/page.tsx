import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgentCard } from '@/components/broker/AgentCard';
import { loadPublicDataSafe } from '@/lib/server/publicData';
import { publicBrokers } from '@/lib/server/landing';
import { areaSlug, brokersInArea, listingsInArea } from '@/lib/propertySearch';
import { absoluteUrl, jsonLdScript, metaDescription } from '@/lib/siteUrl';

type Props = { params: Promise<{ area: string }> };

async function load(params: Props['params']) {
  const slug = decodeURIComponent((await params).area).toLowerCase();
  const data = await loadPublicDataSafe();
  const brokers = brokersInArea(publicBrokers(data), slug).sort(
    (a, b) => b.activeListings - a.activeListings || a.name.localeCompare(b.name),
  );
  if (!brokers.length) return null;
  // The spelling most brokers use for the area.
  const names = new Map<string, number>();
  brokers.forEach((b) =>
    (b.areas || []).forEach((a: string) => {
      const name = String(a).trim();
      if (areaSlug(name) === slug)
        names.set(name, (names.get(name) || 0) + 1);
    }),
  );
  const name = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || slug;
  const listingCount = listingsInArea(data?.listings || [], slug).length;
  return { slug, name, brokers, listingCount };
}

function summary({ name, brokers, listingCount }: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const languages = new Map<string, number>();
  brokers.forEach((b) => (b.languages || []).forEach((l: string) => languages.set(l, (languages.get(l) || 0) + 1)));
  const top = [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l);
  const verified = brokers.filter((b) => b.brnVerified).length;
  let text = `${brokers.length} real estate ${brokers.length === 1 ? 'agent covers' : 'agents cover'} ${name} on Emirate08.`;
  if (verified) text += ` ${verified} ${verified === 1 ? 'has a' : 'have a'} verified RERA broker registration (BRN).`;
  if (top.length) text += ` Languages spoken include ${top.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
  if (listingCount) text += ` ${listingCount} ${listingCount === 1 ? 'property is' : 'properties are'} listed in the area.`;
  return text;
}

export async function generateMetadata({ params }: Props) {
  const l = await load(params);
  if (!l) return { title: 'No agents found', robots: { index: false, follow: true } };
  const title = `Real estate agents in ${l.name}`;
  const description = metaDescription(summary(l) + ' Compare profiles and contact an agent directly.');
  const canonical = `/agents/${l.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: 'Emirate08', title, description, url: absoluteUrl(canonical) },
  };
}

export default async function AgentsInAreaPage({ params }: Props) {
  const l = await load(params);
  if (!l) notFound();
  const url = absoluteUrl(`/agents/${l.slug}`);
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Real estate agents in ${l.name}`,
      url,
      about: { '@type': 'Place', name: l.name },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: l.brokers.length,
        itemListElement: l.brokers.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absoluteUrl('/brokers/' + encodeURIComponent(b.slug)),
          name: b.name,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        ['Home', absoluteUrl('/')],
        ['Agents', absoluteUrl('/agents')],
        [l.name, url],
      ].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
    },
  ];
  return (
    <div className="wrap py-8 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonld) }} />
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
        <ol className="flex flex-wrap gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              Home
            </Link>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden="true">/</span>
            <Link href="/agents" className="hover:underline">
              Agents
            </Link>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden="true">/</span>
            <span aria-current="page">{l.name}</span>
          </li>
        </ol>
      </nav>
      <h1 className="h2 mt-4">Real estate agents in {l.name}</h1>
      <p className="lead mt-3 max-w-[760px]">{summary(l)}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {l.brokers.map((b) => (
          <AgentCard key={b.id} broker={b} />
        ))}
      </div>
      {l.listingCount > 0 && (
        <div className="mt-10">
          <Link href={`/properties/${l.slug}`} className="btn btn-outline btn-sm">
            Properties in {l.name}
          </Link>
        </div>
      )}
    </div>
  );
}
