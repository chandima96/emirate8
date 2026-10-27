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
import { EmptyState } from './EmptyState';

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
/* Price ceilings depend on the purpose; “All” has no ceiling (the select is disabled). */
function maxOptions(purpose) {
  if (purpose === 'rent')
    return [
      ['', 'Any price'],
      [100000, 'Up to AED 100k /yr'],
      [200000, 'Up to AED 200k /yr'],
      [300000, 'Up to AED 300k /yr'],
      [1000000, 'Up to AED 1M /yr'],
    ];
  if (purpose === 'sale')
    return [
      ['', 'Any price'],
      [1500000, 'Up to AED 1.5M'],
      [2000000, 'Up to AED 2M'],
      [3000000, 'Up to AED 3M'],
      [5000000, 'Up to AED 5M'],
      [15000000, 'Up to AED 15M'],
      [50000000, 'Up to AED 50M'],
    ];
  return [['', 'Any price']];
}
const SORTS = {
  newest: (a, b) => a.listed - b.listed,
  featured: (a, b) =>
    (b.display.portfolioFeatured ? 1 : 0) - (a.display.portfolioFeatured ? 1 : 0) || a.listed - b.listed,
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
};
const URL_KEYS = ['purpose', 'q', 'type', 'completion', 'max', 'sort'];

/** Reads the filters from the URL (the source of truth), sanitising the price ceiling for the purpose. */
function fromParams(sp) {
  const purpose = ['sale', 'rent'].includes(sp.get('purpose')) ? sp.get('purpose') : 'all';
  const maxRaw = sp.get('max') || '';
  const max = maxOptions(purpose).some((x) => String(x[0]) === maxRaw) ? maxRaw : '';
  return {
    purpose,
    q: sp.get('q') || '',
    type: sp.get('type') || '',
    completion: sp.get('completion') || '',
    max,
    sort: SORTS[sp.get('sort')] ? sp.get('sort') : 'newest',
  };
}

function search(f, beds) {
  const s = f.q.toLowerCase();
  return publicListings()
    .filter((n) => {
      if (f.purpose !== 'all' && n.purpose !== f.purpose) return false;
      if (f.type && n.type !== f.type) return false;
      if (f.completion && n.completion !== f.completion) return false;
      if (beds !== '') {
        const b = +beds;
        if (b >= 4 ? Number(n.beds) < 4 : Number(n.beds) !== b) return false;
      }
      if (f.max && Number(n.price) > +f.max) return false;
      if (
        s &&
        (
          n.title +
          ' ' +
          n.area +
          ' ' +
          n.emirate +
          ' ' +
          n.type +
          ' ' +
          (n.building || '') +
          ' ' +
          (n.broker ? n.broker.name : '')
        )
          .toLowerCase()
        .indexOf(s) < 0
      )
        return false;
      return true;
    })
    .sort(SORTS[f.sort] || SORTS.newest);
}

export function PropertySearch() {
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
    const next = { ...f, ...patch };
    if (patch.purpose !== undefined && !maxOptions(next.purpose).some((x) => String(x[0]) === String(next.max)))
      next.max = '';
    const url = new URLSearchParams();
    URL_KEYS.forEach((k) => {
      if (next[k] && next[k] !== 'all' && !(k === 'sort' && next[k] === 'newest')) url.set(k, next[k]);
    });
    const s = url.toString();
    router.replace(pathname + (s ? '?' + s : ''), { scroll: false });
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

  const items = ready ? search(f, beds) : [];
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
              <select id="ps-beds" className="select" value={beds} onChange={(e) => setBeds(e.target.value)}>
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
              {ready ? `${items.length} result${items.length === 1 ? '' : 's'}` : ''}
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
          {!ready && <CardSkeletons count={8} />}
          {ready &&
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
        <p className="mt-8 text-[12px] text-muted">Sample listings for demonstration. Photos are illustrative.</p>
      </section>
    </>
  );
}
