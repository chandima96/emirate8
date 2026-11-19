'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PropertyCard } from '@/components/property/PropertyCard';
import { CardSkeletons } from '@/components/ui/CardSkeletons';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { publicListings } from '@/lib/store';
import { TYPES } from '@/config/reference';
import { filterQuery, fromParams, maxOptions, pageCount, pageSlice, searchListings } from '@/lib/propertySearch';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';

const ALL_TYPES = TYPES.residential.concat(TYPES.commercial);
const CHIPS = [
  'Dubai Marina',
  'Downtown Dubai',
  'Business Bay',
  'Palm Jumeirah',
  'Dubai Hills Estate',
  'Dubai Creek Harbour',
  'Jumeirah',
];
const PURPOSES = [
  ['all', 'All'],
  ['sale', 'Buy'],
  ['rent', 'Rent'],
];

/**
 * Property search. The server renders the current page of results (`initialListings`, already filtered
 * and paged for the URL, out of `initialTotal`) so crawlers and first paint get real listings; once the
 * browser store has loaded, results are filtered live from it.
 */
export function PropertySearch({ initialListings = [], initialTotal = 0 }: { initialListings?: any[]; initialTotal?: number }) {
  const { ready } = useSession();
  useStoreVersion();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const f = fromParams(sp);
  /* Bedrooms are not kept in the URL (as before). */
  const [beds, setBeds] = useState('');
  /* The search box follows the URL, but typing is debounced before it reaches the URL. */
  const [qInput, setQInput] = useState(f.q);
  const [syncedQ, setSyncedQ] = useState(f.q);
  if (syncedQ !== f.q) {
    setSyncedQ(f.q);
    setQInput(f.q);
  }
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (patch) => {
    // Any filter change starts again from the first page.
    const next = { ...f, page: 1, ...patch };
    if (patch.purpose !== undefined && !maxOptions(next.purpose).some((x) => String(x[0]) === String(next.max)))
      next.max = '';
    router.replace(pathname + filterQuery(next), { scroll: false });
  };
  const setQuery = (v) => {
    clearTimeout(timer.current);
    setSyncedQ(v);
    update({ q: v });
  };
  const reset = () => {
    clearTimeout(timer.current);
    setBeds('');
    setQInput('');
    setSyncedQ('');
    router.replace(pathname, { scroll: false });
  };

  const all = ready ? searchListings(publicListings(), f, beds) : null;
  const total = all ? all.length : initialTotal;
  const pages = pageCount(total);
  const page = Math.min(f.page, pages);
  const items = all ? pageSlice(all, page) : initialListings;
  // Without server results (none match, or the CMS was unreachable) wait for the store before saying so.
  const loading = !ready && !initialListings.length;
  const label =
    f.purpose === 'rent'
      ? 'Properties for rent'
      : f.purpose === 'sale'
        ? 'Properties for sale'
        : 'Properties for sale & rent';
  useDocumentTitle(label + ' · Emirate08');

  return (
    <>
      <section className="border-b border-line bg-white" aria-label="Search filters">
        <form
          className="wrap grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          role="search"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(qInput.trim());
          }}
        >
          <div className="flex h-11 items-center rounded border border-line bg-white pr-1 pl-3 focus-within:border-ink">
            <Icon name="search" className="h-4 w-4 shrink-0 text-muted" />
            <label htmlFor="ps-q" className="sr-only">
              Community, building or keyword
            </label>
            <input
              id="ps-q"
              type="search"
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-[14px] focus:outline-hidden"
              placeholder="Community, building or keyword"
              value={qInput}
              onChange={(e) => {
                const v = e.target.value;
                setQInput(v);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => setQuery(v.trim()), 180);
              }}
            />
            <button type="submit" className="btn btn-dark btn-sm">
              Search
            </button>
          </div>
          <div className="seg justify-self-start" role="group" aria-label="Purpose">
            {PURPOSES.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={f.purpose === v} onClick={() => update({ purpose: v })}>
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 md:col-span-2">
            <div>
              <label className="sr-only" htmlFor="ps-type">
                Property type
              </label>
              <select id="ps-type" className="select" value={f.type} onChange={(e) => update({ type: e.target.value })}>
                <option value="">Any type</option>
                {ALL_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="sr-only" htmlFor="ps-beds">
                Bedrooms
              </label>
              <select id="ps-beds" className="select" value={beds} onChange={(e) => {
                  setBeds(e.target.value);
                  if (f.page > 1) update({});
                }}>
                <option value="">Any beds</option>
                <option value="0">Studio</option>
                <option value="1">1 bed</option>
                <option value="2">2 beds</option>
                <option value="3">3 beds</option>
                <option value="4">4+ beds</option>
              </select>
            </div>
            <div>
              <label className="sr-only" htmlFor="ps-completion">
                Completion
              </label>
              <select
                id="ps-completion"
                className="select"
                value={f.completion}
                onChange={(e) => update({ completion: e.target.value })}
              >
                <option value="">Ready &amp; off-plan</option>
                <option value="ready">Ready</option>
                <option value="offplan">Off-plan</option>
              </select>
            </div>
            <div>
              <label className="sr-only" htmlFor="ps-max">
                Maximum price
              </label>
              <select
                id="ps-max"
                className="select"
                value={f.max}
                disabled={f.purpose === 'all'}
                onChange={(e) => update({ max: e.target.value })}
              >
                {maxOptions(f.purpose).map(([v, l]) => (
                  <option key={l} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="sr-only" htmlFor="ps-sort">
                Sort by
              </label>
              <select id="ps-sort" className="select" value={f.sort} onChange={(e) => update({ sort: e.target.value })}>
                <option value="newest">Newest first</option>
                <option value="featured">Most photos</option>
                <option value="priceAsc">Price: low to high</option>
                <option value="priceDesc">Price: high to low</option>
              </select>
            </div>
          </div>
        </form>
      </section>
      <section className="wrap py-8 sm:py-10" aria-labelledby="results-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="results-title" className="h3">
              {label + (f.q ? ' in ' + f.q : ' in the UAE')}
            </h1>
            <p className="mt-1 text-[13px] text-muted" aria-live="polite">
              {loading ? '' : `${total} result${total === 1 ? '' : 's'}${pages > 1 ? ` · page ${page} of ${pages}` : ''}`}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            <Icon name="arrow-counterclockwise" />
            Clear filters
          </button>
        </div>
        <div className="mt-5 no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Popular communities">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className="chip shrink-0 px-3 py-1.5 text-[12px] hover:border-ink"
              onClick={() => {
                setQInput(c);
                setQuery(c);
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {loading && <CardSkeletons count={8} />}
          {!loading &&
            (items.length ? (
              items.map((n) => <PropertyCard key={n.id} listing={n} />)
            ) : (
              <EmptyState
                title="No properties match your search"
                text="Try another community, a wider price range, or clear the filters."
              >
                <button type="button" className="btn btn-outline btn-sm mt-4" onClick={reset}>
                  Clear filters
                </button>
              </EmptyState>
            ))}
        </div>
        {!loading && <Pagination path={pathname} filters={f} page={page} pages={pages} className="mt-8" />}
        <p className="mt-8 text-[12px] text-muted">Sample listings for demonstration. Photos are illustrative.</p>
      </section>
    </>
  );
}
