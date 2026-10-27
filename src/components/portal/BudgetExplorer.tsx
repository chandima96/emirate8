'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { PropertyCard } from '@/components/property/PropertyCard';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { publicListings } from '@/lib/store';
import { useCarousel } from './useCarousel';

const CARD = 'w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[290px]';
const MAX = {
  rent: [
    [100000, 'AED 100,000 /yr'],
    [200000, 'AED 200,000 /yr'],
    [300000, 'AED 300,000 /yr'],
    [1000000, 'AED 1,000,000 /yr'],
  ],
  sale: [
    [1500000, 'AED 1,500,000'],
    [3000000, 'AED 3,000,000'],
    [5000000, 'AED 5,000,000'],
    [15000000, 'AED 15,000,000'],
    [50000000, 'AED 50,000,000'],
  ],
};
const AREAS = [
  'Dubai Marina',
  'Downtown Dubai',
  'Business Bay',
  'Palm Jumeirah',
  'Dubai Hills Estate',
  'Dubai Creek Harbour',
  'Jumeirah',
  'Al Barari',
];

/** “See what fits your budget”: purpose, ceiling and community → matching listings, most expensive first. */
export function BudgetExplorer() {
  const { ready } = useSession();
  useStoreVersion();
  const [purpose, setPurpose] = useState('sale');
  const [max, setMax] = useState(MAX.sale[1][0]);
  const [area, setArea] = useState('');
  const list = ready
    ? publicListings()
        .filter((n) => n.purpose === purpose && Number(n.price) <= Number(max) && (!area || n.area === area))
        .sort((a, b) => Number(b.price) - Number(a.price))
    : [];
  const { track, prev, next, prevDisabled, nextDisabled } = useCarousel(`${ready}|${purpose}|${max}|${area}`);
  const href = `/properties?purpose=${purpose}&max=${max}${area ? '&q=' + encodeURIComponent(area) : ''}`;

  return (
    <section className="pb-14 sm:pb-16" aria-labelledby="bud-title">
      <div className="wrap">
        <div className="grid gap-6 rounded-lg bg-mist p-5 sm:p-8 lg:grid-cols-[340px_1fr] lg:gap-10 lg:p-10">
          <div className="flex flex-col">
            <p className="eyebrow">Budget explorer</p>
            <h2 id="bud-title" className="h3 mt-3">
              See what fits <em className="f font-normal">your budget</em>
            </h2>
            <p className="mt-2 text-[14px] leading-[1.6] text-muted">
              Pick a purpose, a ceiling and a community. We’ll show matching listings straight away.
            </p>
            <div className="mt-6 grid gap-3.5">
              <div>
                <label className="label" htmlFor="bud-purpose">
                  I want to
                </label>
                <select
                  id="bud-purpose"
                  className="select"
                  value={purpose}
                  onChange={(e) => {
                    const p = e.target.value;
                    setPurpose(p);
                    setMax(MAX[p][1][0]);
                  }}
                >
                  <option value="sale">Buy</option>
                  <option value="rent">Rent</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="bud-max">
                  Maximum price
                </label>
                <select id="bud-max" className="select" value={max} onChange={(e) => setMax(+e.target.value)}>
                  {MAX[purpose].map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="bud-area">
                  Community
                </label>
                <select id="bud-area" className="select" value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="">Any community</option>
                  {AREAS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
              <span className="text-[13px] font-semibold text-ink" aria-live="polite">
                {ready ? `${list.length} match${list.length === 1 ? '' : 'es'}` : ''}
              </span>
              <Link href={href} className="btn btn-dark btn-sm">
                See all matches
                <Icon name="arrow-right" />
              </Link>
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-4 flex justify-end gap-2">
              <button
                type="button"
                className="icon-round"
                onClick={prev}
                disabled={prevDisabled}
                aria-label="Previous matches"
              >
                <Icon name="chevron-left" className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="icon-round"
                onClick={next}
                disabled={nextDisabled}
                aria-label="Next matches"
              >
                <Icon name="chevron-right" className="h-5 w-5" />
              </button>
            </div>
            <div
              ref={track}
              className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
              tabIndex={0}
              aria-label="Properties within budget"
            >
              {list.length
                ? list
                    .slice(0, 6)
                    .map((n) => <PropertyCard key={n.id} listing={n} tag="Within budget" className={CARD} />)
                : ready && (
                    <div className="flex w-full min-w-[260px] flex-col items-start justify-center rounded-lg border border-dashed border-line bg-white p-8">
                      <p className="font-display text-[16px] font-semibold text-ink">No listings in this range yet</p>
                      <p className="mt-1 text-[13px] text-muted">Try a higher budget or another community.</p>
                    </div>
                  )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
