'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { PropertyCard } from '@/components/property/PropertyCard';
import { COMMUNITIES } from '@/config/communities';
import { publicListings } from '@/lib/store';
import { routes } from '@/lib/routes';

/** 07 — general community information (orientation only) and more public listings in the same area. */
export function CommunityInsights({ listing: l, preview }) {
  const c = COMMUNITIES[l.area];
  if (!c) return null;
  const same = preview
    ? []
    : publicListings()
        .filter((x) => x.area === l.area && x.id !== l.id)
        .slice(0, 3);

  return (
    <section id="community" className="mt-12 scroll-mt-24" aria-labelledby="h-com">
      <h2 id="h-com" className="h3">
        Discover {l.area}
      </h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 text-[14px] leading-[1.7] text-text">
          <p>{c.about}</p>
          <p>{c.lifestyle}</p>
          <p>
            <span className="font-semibold text-ink">Getting around. </span>
            {c.connectivity}
          </p>
        </div>
        <div className="card divide-y divide-line">
          <div className="p-4">
            <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Property types</p>
            <p className="mt-1.5 text-[14px] text-ink">{c.types.join(' · ')}</p>
          </div>
          <div className="p-4">
            <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Community highlights</p>
            <ul className="mt-1.5 space-y-1 text-[14px] text-ink">
              {c.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2">
                  <Icon name="check2" className="h-4 w-4 text-sage-ink" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-4">
            <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Nearby amenities</p>
            <p className="mt-1.5 text-[14px] text-ink">{c.nearby.shopping}</p>
          </div>
        </div>
      </div>
      {!!same.length && (
        <div className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <h3 className="h4">More properties in {l.area}</h3>
            <Link className="tlink text-[14px]" href={routes.properties({ q: l.area })}>
              See all
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {same.map((x) => (
              <PropertyCard key={x.id} listing={x} />
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-2xs text-muted">
        General community information for orientation. Emirate08 does not publish demographic or investment statistics
        without a verified source.
      </p>
    </section>
  );
}
