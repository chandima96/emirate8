'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { counts, fmtNumber, isSelected, network, plan, select } from '@/lib/store';
import { AREAS, EMIRATES, TYPES } from '@/config/reference';
import { cx } from '@/lib/utils';
import { ContactModal, NetworkCard, agencyOf, useSelectToggle } from './NetworkBits';

const ALL_TYPES = TYPES.residential.concat(TYPES.commercial);
const blank = (purpose, sort = undefined) => ({
  purpose: purpose || 'all',
  search: '',
  emirate: '',
  area: '',
  type: '',
  beds: '',
  price: '',
  completion: '',
  sort: sort || 'newest',
});
function priceOptions(purpose) {
  if (purpose === 'rent')
    return [
      ['', 'Any rent'],
      ['0-100000', 'Up to AED 100k /yr'],
      ['100000-200000', 'AED 100k – 200k /yr'],
      ['200000-', 'AED 200k+ /yr'],
    ];
  if (purpose === 'sale')
    return [
      ['', 'Any price'],
      ['0-2000000', 'Up to AED 2M'],
      ['2000000-5000000', 'AED 2M – 5M'],
      ['5000000-15000000', 'AED 5M – 15M'],
      ['15000000-', 'AED 15M+'],
    ];
  return [['', 'Any price']];
}
const SORTERS = {
  newest: (a, b) => a.listed - b.listed,
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  size: (a, b) => b.size - a.size,
};
function results(f) {
  return network()
    .filter((n) => {
      if (!n.available) return false;
      if (f.purpose !== 'all' && n.purpose !== f.purpose) return false;
      if (f.emirate && n.emirate !== f.emirate) return false;
      if (f.area && n.area !== f.area) return false;
      if (f.type && n.type !== f.type) return false;
      if (f.completion && n.completion !== f.completion) return false;
      if (f.beds !== '') {
        const b = +f.beds;
        if (b === 0 ? Number(n.beds) !== 0 : b >= 4 ? Number(n.beds) < 4 : Number(n.beds) !== b) return false;
      }
      if (f.price) {
        const pr = f.price.split('-');
        if (Number(n.price) < +pr[0] || (pr[1] && Number(n.price) > +pr[1])) return false;
      }
      if (f.search) {
        const s = f.search.toLowerCase();
        if (
          (n.title + ' ' + n.area + ' ' + n.broker.name + ' ' + agencyOf(n) + ' ' + n.type).toLowerCase().indexOf(s) ===
          -1
        )
          return false;
      }
      return true;
    })
    .sort(SORTERS[f.sort]);
}

function Sel({ id, label, value, onChange, disabled = undefined, children }) {
  return (
    <div>
      <label className="label text-2xs" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="select input-sm h-9"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

/** Broker network browse page (old network.html + network.js browse part). */
export function Network() {
  useStoreVersion();
  const { toast } = useFeedback();
  const toggle = useSelectToggle();
  const q = useSearchParams();
  const [f, setF] = useState(() => blank(['sale', 'rent'].includes(q.get('purpose')) ? q.get('purpose') : 'all'));
  const [searchText, setSearchText] = useState('');
  const [bulk, setBulk] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [contactId, setContactId] = useState(null);

  /* debounced search (150 ms) */
  useEffect(() => {
    const t = setTimeout(
      () => setF((cur) => (cur.search === searchText.trim() ? cur : { ...cur, search: searchText.trim() })),
      150,
    );
    return () => clearTimeout(t);
  }, [searchText]);

  const areaList = f.emirate ? AREAS[f.emirate] : EMIRATES.flatMap((e) => AREAS[e]);
  const list = results(f);
  const p = plan();
  const c = counts();
  const chosen = Object.keys(bulk).filter((k) => bulk[k] && !isSelected(k));
  const active = ['emirate', 'area', 'type', 'beds', 'price', 'completion'].filter((k) => f[k] !== '').length;
  const priceOpts = useMemo(() => priceOptions(f.purpose), [f.purpose]);

  const set = (k) => (v) =>
    setF((cur) => {
      const next = { ...cur, [k]: v };
      if (k === 'emirate') {
        const al = v ? AREAS[v] : EMIRATES.flatMap((e) => AREAS[e]);
        if (al.indexOf(next.area) < 0) next.area = '';
      }
      if (k === 'purpose') next.price = '';
      return next;
    });
  const reset = () => {
    setF(blank('all', f.sort));
    setSearchText('');
  };
  const chooseAll = () => {
    const next = { ...bulk };
    list.forEach((n) => {
      if (!isSelected(n.id)) next[n.id] = true;
    });
    setBulk(next);
  };
  const addChosen = () => {
    const r = select(chosen);
    setBulk({});
    if (r.blocked)
      toast(
        <>
          Added {r.added}. {r.blocked} couldn’t be added — your plan’s {fmtNumber(r.limit)} slots are full.{' '}
          <Link className="underline" href="/subscription">
            Compare plans
          </Link>
        </>,
        { icon: 'exclamation-circle', duration: 5500 },
      );
    else
      toast('Added ' + r.added + ' properties to Selected · ' + r.used + ' / ' + fmtNumber(r.limit) + ' slots used.', {
        icon: 'bookmark-check-fill',
      });
  };

  return (
    <>
      <div className="mx-auto max-w-[1240px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="h2 text-[24px] lg:text-[28px]">Broker Network</h1>
            <p className="mt-1 max-w-[560px] text-[14px] text-muted">
              Browse property opportunities published by participating brokers, then select the ones you want to follow
              up.
            </p>
          </div>
          <div className="w-full max-w-[260px] rounded-lg border border-line bg-white p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Plan quota</span>
              <span className="font-semibold text-ink">
                {c.selected} / {fmtNumber(p.selections)} selection slots
              </span>
            </div>
            <div className="meter mt-2">
              <span style={{ width: Math.min(100, (c.selected / p.selections) * 100) + '%' }} />
            </div>
          </div>
        </div>

        {/* Search & filters */}
        <div className="mt-6 rounded-lg border border-line bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="seg" role="group" aria-label="Purpose">
              {[
                ['all', 'All'],
                ['sale', 'Sale'],
                ['rent', 'Rent'],
              ].map(([v, l]) => (
                <button key={v} type="button" aria-pressed={f.purpose === v} onClick={() => set('purpose')(v)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="relative min-w-[200px] flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <label htmlFor="nf-search" className="sr-only">
                Search the network
              </label>
              <input
                id="nf-search"
                type="search"
                className="input input-sm h-9 pl-9"
                placeholder="Search by title, area, broker or agency"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm h-9 md:hidden"
              aria-expanded={filtersOpen}
              aria-controls="nf-panel"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Icon name="sliders" />
              Filters <span>{active ? '(' + active + ')' : ''}</span>
            </button>
            <div className="flex items-center gap-2">
              <label htmlFor="nf-sort" className="hidden text-xs text-muted sm:block">
                Sort
              </label>
              <select
                id="nf-sort"
                className="select input-sm h-9 w-auto min-w-[150px]"
                value={f.sort}
                onChange={(e) => set('sort')(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="priceAsc">Price: low to high</option>
                <option value="priceDesc">Price: high to low</option>
                <option value="size">Largest first</option>
              </select>
            </div>
          </div>
          <div
            id="nf-panel"
            className={cx(
              'mt-3 grid-cols-2 gap-2 border-t border-line pt-3 md:grid md:grid-cols-3 xl:grid-cols-6',
              filtersOpen ? 'grid' : 'hidden',
            )}
          >
            <Sel id="nf-emirate" label="Emirate" value={f.emirate} onChange={set('emirate')}>
              <option value="">All emirates</option>
              {EMIRATES.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </Sel>
            <Sel id="nf-area" label="Area" value={f.area} onChange={set('area')}>
              <option value="">All areas</option>
              {areaList.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Sel>
            <Sel id="nf-type" label="Type" value={f.type} onChange={set('type')}>
              <option value="">All types</option>
              {ALL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Sel>
            <Sel id="nf-beds" label="Bedrooms" value={f.beds} onChange={set('beds')}>
              <option value="">Any</option>
              <option value="0">Studio</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4+</option>
            </Sel>
            <Sel id="nf-price" label="Price" value={f.price} onChange={set('price')} disabled={f.purpose === 'all'}>
              {priceOpts.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Sel>
            <Sel id="nf-completion" label="Completion" value={f.completion} onChange={set('completion')}>
              <option value="">Any</option>
              <option value="ready">Ready</option>
              <option value="offplan">Off-plan</option>
            </Sel>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <p>
            <span className="font-semibold text-ink">
              {list.length + (list.length === 1 ? ' property' : ' properties')}
            </span>{' '}
            · sample records with illustrative photos
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="font-semibold text-ink underline-offset-4 hover:underline"
              onClick={chooseAll}
            >
              Choose all results
            </button>
            <button type="button" className="hover:text-ink" onClick={reset}>
              Reset filters
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
          {list.length ? (
            list.map((n) => (
              <NetworkCard
                key={n.id}
                n={n}
                bulk
                bulkChecked={bulk[n.id]}
                onBulk={(id, on) => setBulk((b) => ({ ...b, [id]: on }))}
                onToggle={toggle}
                onContact={setContactId}
              />
            ))
          ) : (
            <div className="col-span-full rounded-lg border border-dashed border-line bg-white p-10 text-center">
              <Icon name="search" className="mx-auto h-6 w-6 text-muted" />
              <p className="mt-3 font-display text-[16px] font-semibold text-ink">No properties match these filters</p>
              <p className="mt-1 text-[13px] text-muted">Try a different area, type, or price range.</p>
              <button type="button" className="btn btn-outline btn-sm mt-4" onClick={reset}>
                Reset filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 lg:pl-[224px]">
          <div className="flex w-full max-w-[560px] items-center gap-3 rounded-lg bg-ink px-4 py-3 text-white shadow-pop">
            <Icon name="list-check" className="h-5 w-5 text-sage" />
            <p className="flex-1 text-[13px]" role="status">
              <span className="font-semibold">{chosen.length} chosen</span>
              <span className="hidden text-[#A9B4B1] sm:inline"> · add them to your Selected Properties</span>
            </p>
            <button type="button" className="btn btn-sm text-white/80 hover:text-white" onClick={() => setBulk({})}>
              Clear
            </button>
            <button type="button" className="btn btn-sage btn-sm" onClick={addChosen}>
              <Icon name="bookmark-plus" />
              Select all chosen
            </button>
          </div>
        </div>
      )}
      <ContactModal id={contactId} onClose={() => setContactId(null)} />
    </>
  );
}
