'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { PropertyCard } from '@/components/property/PropertyCard';
import { CardSkeletons } from '@/components/ui/CardSkeletons';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { publicListings } from '@/lib/store';
import { useCarousel } from './useCarousel';

const CARD = 'w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[290px]';

/** “Properties for you” — the eight newest public listings in a carousel. */
export function RecentListings() {
  const { ready } = useSession();
  useStoreVersion();
  const rec = ready
    ? publicListings()
        .slice()
        .sort((a, b) => a.listed - b.listed)
        .slice(0, 8)
    : [];
  const { track, prev, next, prevDisabled, nextDisabled } = useCarousel(ready ? rec.length : -1);
  return (
    <section className="py-14 sm:py-16" aria-labelledby="rec-title">
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Recently listed</p>
            <h2 id="rec-title" className="h3 mt-3">
              Properties for you
            </h2>
            <p className="mt-1 text-[14px] text-muted">The newest sample listings across Dubai and the UAE.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/properties?sort=newest" className="tlink mr-2 hidden sm:inline">
              View all
            </Link>
            <button
              type="button"
              className="icon-round"
              onClick={prev}
              disabled={prevDisabled}
              aria-label="Previous properties"
            >
              <Icon name="chevron-left" className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="icon-round"
              onClick={next}
              disabled={nextDisabled}
              aria-label="Next properties"
            >
              <Icon name="chevron-right" className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div
          ref={track}
          className="-mx-4 mt-6 no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0"
          tabIndex={0}
          aria-label="Recommended properties"
        >
          {!ready && <CardSkeletons count={4} className={CARD} />}
          {rec.map((l) => (
            <PropertyCard key={l.id} listing={l} className={CARD} />
          ))}
        </div>
        <Link href="/properties?sort=newest" className="tlink mt-4 inline-block sm:hidden">
          View all properties
        </Link>
      </div>
    </section>
  );
}
