'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { TYPES } from '@/config/reference';
import { counts, data, fmtPrice, log, plan, relTime, saveData } from '@/lib/store';
import { routes } from '@/lib/routes';
import { cx } from '@/lib/utils';
import { ActionsMenu } from './ActionsMenu';
import { StatusBadge, Thumb, VisBadge } from './bits';
import { useListingActions } from './useListingActions';

const TABS = [
  ['all', 'All listings'],
  ['sale', 'For sale'],
  ['rent', 'For rent'],
  ['offplan', 'Off-plan'],
];
const SORTS = {
  updated: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  priceDesc: (a, b) => (b.price || 0) - (a.price || 0),
  priceAsc: (a, b) => (a.price || 0) - (b.price || 0),
  title: (a, b) => (a.title || '').localeCompare(b.title || ''),
};
const STATUS_FILTER = new Set(['published', 'draft', 'pending', 'unpublished', 'closed', 'archived']);

function matches(l, f) {
  if (f.tab === 'offplan') {
    if (l.completion !== 'offplan') return false;
  } else if (f.tab !== 'all' && l.purpose !== f.tab) return false;
  if (
    f.status === 'closed'
      ? !(l.status === 'sold' || l.status === 'rented')
      : f.status === 'draft'
        ? !(l.status === 'draft' || l.status === 'pending')
        : f.status && l.status !== f.status
  )
    return false;
  if (f.type && l.type !== f.type) return false;
  if (
    f.search &&
    [l.title || '', l.area || '', l.building || '', l.ref || '', (l.permit && l.permit.number) || '']
      .join(' ')
      .toLowerCase()
      .indexOf(f.search.toLowerCase()) === -1
  )
    return false;
  return true;
}

/** My Listings — stats, purpose tabs, filters, table (desktop) and cards (mobile) with listing actions. */
export function ListingsList() {
  useStoreVersion();
  const q = useSearchParams();
  const { confirm } = useFeedback();
  const actions = useListingActions();
  const initialStatus = q.get('status');
  const [tab, setTab] = useState('all');
  const [status, setStatus] = useState(STATUS_FILTER.has(initialStatus) ? initialStatus : '');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('updated');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const all = data().listings;
  const items = all.filter((l) => matches(l, { tab, status, type, search })).sort(SORTS[sort]);
  const c = counts();
  const p = plan();
  const tabCount = {
    all: all.length,
    sale: all.filter((l) => l.purpose === 'sale').length,
    rent: all.filter((l) => l.purpose === 'rent').length,
    offplan: all.filter((l) => l.completion === 'offplan').length,
  };
  const stats = [
    ['Published', c.published, p.listings ? 'of ' + p.listings + ' on ' + p.name : 'Fair use', 'published'],
    ['Drafts & pending', c.draft + c.pending, c.pending ? c.pending + ' pending review' : 'Not yet public', 'draft'],
    ['Unpublished', c.unpublished, 'Hidden from buyers', 'unpublished'],
    ['Sold & rented', c.closed, c.archived ? c.archived + ' archived' : 'Completed', 'closed'],
  ];
  const typeOptions = useMemo(() => TYPES.residential.concat(TYPES.commercial), []);
  const hasSamples = all.some((l) => l.sample);

  async function clearSamples() {
    const ok = await confirm({
      title: 'Clear sample records?',
      body: 'All listings marked “Sample” will be removed. Listings you created stay.',
      ok: 'Clear samples',
      danger: true,
    });
    if (!ok) return;
    const d = data();
    d.listings = d.listings.filter((l) => !l.sample);
    saveData(d);
    log('Cleared sample listings', 'eraser');
  }

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h2 text-[24px] lg:text-[28px]">My Listings</h1>
          <p className="mt-1 text-[14px] text-muted">
            Create, preview, publish and manage your ready and off-plan listings.
          </p>
        </div>
        <div className="flex gap-2">
          {hasSamples && (
            <button type="button" className="btn btn-ghost" onClick={clearSamples}>
              <Icon name="eraser" />
              Clear sample records
            </button>
          )}
          <Link href="/listings/new" className="btn btn-dark">
            <Icon name="plus-lg" />
            Add Property
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, value, note, key]) => (
          <button
            key={key}
            type="button"
            className={cx('kpi text-left transition-colors hover:border-[#B8C3BE]', status === key && 'border-ink')}
            aria-pressed={status === key}
            onClick={() => setStatus(status === key ? '' : key)}
          >
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-2 font-display text-[24px] leading-none font-semibold text-ink">{value}</p>
            <p className="mt-1.5 text-2xs text-muted">{note}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-line bg-white">
        <div className="tabbar px-3" role="tablist" aria-label="Purpose">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {label} <span className="ml-1 text-2xs text-muted">{tabCount[key]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
            />
            <label htmlFor="lf-search" className="sr-only">
              Search listings
            </label>
            <input
              id="lf-search"
              type="search"
              className="input input-sm h-9 pl-9"
              placeholder="Search title, area or permit number"
              value={searchText}
              onChange={(e) => {
                const v = e.target.value;
                setSearchText(v);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => setSearch(v.trim()), 150);
              }}
            />
          </div>
          <label htmlFor="lf-status" className="sr-only">
            Status
          </label>
          <select
            id="lf-status"
            className="select input-sm h-9 w-auto min-w-[150px]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending review</option>
            <option value="unpublished">Unpublished</option>
            <option value="closed">Sold / Rented</option>
            <option value="archived">Archived</option>
          </select>
          <label htmlFor="lf-type" className="sr-only">
            Property type
          </label>
          <select
            id="lf-type"
            className="select input-sm h-9 w-auto min-w-[140px]"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <label htmlFor="lf-sort" className="sr-only">
            Sort
          </label>
          <select
            id="lf-sort"
            className="select input-sm h-9 w-auto min-w-[160px]"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="updated">Recently updated</option>
            <option value="priceDesc">Price: high to low</option>
            <option value="priceAsc">Price: low to high</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block xl:overflow-visible">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th>Property</th>
                <th>Type</th>
                <th>Price</th>
                <th>Visibility</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={routes.listing(l.id)} className="flex items-center gap-3">
                      <Thumb listing={l} className="h-11 w-16 shrink-0 rounded" />
                      <span className="min-w-0">
                        <span className="block max-w-[280px] truncate font-semibold text-ink hover:underline">
                          {l.title || 'Untitled listing'}
                        </span>
                        <span className="block text-2xs text-muted">
                          {l.area || 'No location yet'} · {l.ref || ''}
                          {l.display.portfolioFeatured && (
                            <>
                              {' · '}
                              <span className="font-semibold text-ink">★ Featured</span>
                            </>
                          )}
                          {l.sample && (
                            <>
                              {' · '}
                              <span className="font-semibold text-sage-ink">Sample</span>
                            </>
                          )}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="text-muted">
                    {l.type || '—'}
                    <span className="block text-2xs">
                      {(l.completion === 'offplan' ? 'Off-plan · ' : 'Ready · ') +
                        (l.purpose === 'rent' ? 'Rent' : 'Sale')}
                    </span>
                  </td>
                  <td className="font-semibold whitespace-nowrap text-ink">
                    {l.price ? fmtPrice(l) : <span className="font-normal text-muted">—</span>}
                  </td>
                  <td>
                    <VisBadge listing={l} />
                  </td>
                  <td>
                    <StatusBadge listing={l} />
                  </td>
                  <td className="text-xs whitespace-nowrap text-muted">{relTime(l.updatedAt)}</td>
                  <td className="text-right">
                    <ActionsMenu listing={l} actions={actions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-line md:hidden">
          {items.map((l) => (
            <div key={l.id} className="flex gap-3 p-3">
              <Link href={routes.listing(l.id)} className="shrink-0" tabIndex={-1} aria-hidden="true">
                <Thumb listing={l} className="h-20 w-24 rounded" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={routes.listing(l.id)} className="truncate text-[13px] font-semibold text-ink">
                    {l.title || 'Untitled listing'}
                  </Link>
                  <ActionsMenu listing={l} actions={actions} />
                </div>
                <p className="text-2xs text-muted">
                  {(l.area || 'No location yet') +
                    ' · ' +
                    (l.completion === 'offplan' ? 'Off-plan' : 'Ready') +
                    (l.sample ? ' · Sample' : '')}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-ink">{l.price ? fmtPrice(l) : '—'}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge listing={l} />
                  <VisBadge listing={l} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {!items.length && (
          <div className="p-10 text-center">
            {all.length ? (
              <>
                <p className="font-display text-[16px] font-semibold text-ink">No listings match</p>
                <p className="mt-1 text-[13px] text-muted">Try another status, type or search.</p>
              </>
            ) : (
              <>
                <Icon name="buildings" className="mx-auto h-6 w-6 text-muted" />
                <p className="mt-3 font-display text-[16px] font-semibold text-ink">No listings yet</p>
                <p className="mt-1 text-[13px] text-muted">Create your first ready or off-plan listing.</p>
                <Link href="/listings/new" className="btn btn-dark btn-sm mt-4">
                  <Icon name="plus-lg" />
                  Add Property
                </Link>
              </>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-2xs text-muted">
        Records marked “Sample” are illustrative demo data. Photos are illustrative and do not show the advertised
        units.
      </p>
    </div>
  );
}
