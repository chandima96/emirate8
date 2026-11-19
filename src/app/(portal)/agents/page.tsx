import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Directory } from '@/components/portal/Directory';
import { IMG } from '@/config/images';
import { loadPublicDataSafe } from '@/lib/server/publicData';
import { publicBrokers } from '@/lib/server/landing';
import { brokerAreas } from '@/lib/propertySearch';

export const metadata = {
  title: 'Find a Real Estate Agent or Agency in Dubai',
  description:
    'Search Dubai real estate brokers and agencies by community or name, with registration numbers, languages and current listings.',
  alternates: { canonical: '/agents' },
  openGraph: { type: 'website', siteName: 'Emirate08', title: 'Find a Real Estate Agent or Agency in Dubai', url: '/agents' },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AgentsPage({ searchParams }: Props) {
  // Reading the URL renders the page per request, so the directory's first HTML has real profiles.
  await searchParams;
  const data = await loadPublicDataSafe();
  const initialBrokers = publicBrokers(data);
  const initialAgencies = data?.agencies || [];
  const areas = brokerAreas(initialBrokers);
  return (
    <div>
      {/* No Suspense boundary: the page renders per request, so profiles go straight into the HTML. */}
      <Directory
          heroImage={
            <img
              src={IMG + 'business-bay.webp'}
              alt="Business Bay towers along the Dubai Water Canal"
              className="hidden aspect-[4/3] w-full rounded-lg object-cover lg:block"
              width="1280"
              height="960"
            />
          }
          initialBrokers={initialBrokers}
          initialAgencies={initialAgencies}
        />
      {areas.length > 0 && (
        <section className="wrap pb-12" aria-labelledby="agent-areas">
          <h2 id="agent-areas" className="h4">
            Find an agent by area
          </h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((a) => (
              <li key={a.slug}>
                <Link href={`/agents/${a.slug}`} className="hover:underline">
                  Real estate agents in {a.name}
                </Link>{' '}
                <span className="text-muted">({a.count})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="wrap pb-16" aria-labelledby="pro-cta">
        <div className="flex flex-col items-start justify-between gap-5 rounded-lg bg-mist p-7 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 id="pro-cta" className="h4">
              Are you a broker or agency?
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              Create a verified profile and publish your listings to buyers and tenants.
            </p>
          </div>
          <Link href="/for-professionals" className="btn btn-dark shrink-0">
            Emirate08 for professionals
            <Icon name="arrow-right" />
          </Link>
        </div>
      </section>
    </div>
  );
}
