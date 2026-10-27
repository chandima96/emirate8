import { Suspense } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Directory } from '@/components/portal/Directory';
import { CardSkeletons } from '@/components/ui/CardSkeletons';
import { IMG } from '@/config/images';

export const metadata = {
  title: 'Find a Real Estate Agent or Agency in Dubai',
  description:
    'Search sample Dubai real estate brokers and agencies by community or name, with registration numbers, languages and current listings.',
};

export default function AgentsPage() {
  return (
    <div>
      <Suspense
        fallback={
          <div className="wrap grid gap-4 py-10 md:grid-cols-2">
            <CardSkeletons count={4} variant="agent" />
          </div>
        }
      >
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
        />
      </Suspense>
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
