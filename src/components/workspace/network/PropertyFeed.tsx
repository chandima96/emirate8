'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Field';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion, usePublicListings } from '@/hooks/useStore';
import { fmtNumber, fmtPrice, listingUrl, relTime } from '@/lib/store';
import { copyText } from '@/lib/share';
import { cx } from '@/lib/utils';
import { FEED_DEFAULT_LIMIT, FEED_PAGE_LIMIT, isInFeed } from '@/lib/propertyFeed';
import {
  changeFeed,
  excludeFromFeed,
  feedStore,
  generateFeedKey,
  includeInFeed,
  loadFeed,
  revokeFeedKey,
  useFeed,
} from '@/lib/feedClient';
import { SpecLine, agencyOf, netUrl } from './NetworkBits';
import { FeedTester } from './FeedTester';

const BLANK = { view: 'all', search: '', purpose: '', type: '', completion: '', source: '', area: '', beds: '' };
const PAGE = 30;

/** "mine" = the account's own listings; for an agency also every listing the agency owns (its team brokers' too). */
function sourceOf(n, user) {
  if (user?.id != null && String(n.brokerId) === String(user.id)) return 'mine';
  const agencyId = user?.type === 'agency' ? user.agency?.agencyId : null;
  if (agencyId != null && String(n.ownerAgency ?? '') === String(agencyId)) return 'mine';
  if (n.ownerDirect || (!n.broker && n.owner)) return 'developer';
  return 'network';
}

function CopyField({ id, label, value, mono = true }) {
  const { toast } = useFeedback();
  return (
    <div>
      <label className="label text-2xs" htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          className={cx('input input-sm h-9 flex-1', mono && 'font-mono text-[12px]')}
          value={value}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="btn btn-outline btn-sm h-9"
          onClick={() => copyText(value).then(() => toast('Copied to clipboard.'), () => toast('Select the text and copy it manually.', { icon: 'exclamation-circle' }))}
        >
          <Icon name="clipboard" />
          Copy
        </button>
      </div>
    </div>
  );
}

function ApiAccess({ inFeedCount, onNewKey }) {
  const feed = useFeed();
  const { toast, confirm } = useFeedback();
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const generate = async () => {
    if (feed.key) {
      const ok = await confirm({
        title: 'Rotate API key?',
        body: 'The current key stops working immediately. Update every website that uses it with the new key.',
        ok: 'Rotate key',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const key = await generateFeedKey();
      setNewKey(key);
      onNewKey(key);
    } catch (error) {
      toast(error.message, { icon: 'exclamation-circle' });
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    const ok = await confirm({
      title: 'Revoke API key?',
      body: 'Websites using this key will stop receiving properties. Your property selection is kept.',
      ok: 'Revoke key',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await revokeFeedKey();
      toast('API key revoked.', { icon: 'shield-x' });
    } catch (error) {
      toast(error.message, { icon: 'exclamation-circle' });
    } finally {
      setBusy(false);
    }
  };

  const sample = `curl "${feed.endpoint}?purpose=sale&limit=${FEED_DEFAULT_LIMIT}" \\\n  -H "Authorization: Bearer ${feed.key ? 'YOUR_API_KEY' : '<generate a key first>'}"`;

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="api-access-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="api-access-title" className="text-[15px] font-semibold text-ink">
            API access
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Your website or CRM calls this endpoint with your key and receives the {fmtNumber(inFeedCount)} properties in
            your feed.
          </p>
        </div>
        {feed.key ? (
          <span className="badge badge-ok">
            <span className="dot" />
            Key active
          </span>
        ) : (
          <span className="badge badge-muted">No key</span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CopyField id="feed-endpoint" label="Endpoint (GET)" value={feed.endpoint} />
        <div>
          <p className="label text-2xs">API key</p>
          {feed.key ? (
            <div className="flex h-9 items-center justify-between gap-2 rounded border border-line bg-mist/40 px-3">
              <code className="truncate font-mono text-[12px] text-ink">{feed.key.prefix}</code>
              <span className="shrink-0 text-2xs text-muted">
                {feed.key.lastUsedAt ? 'Last used ' + relTime(feed.key.lastUsedAt).toLowerCase() : 'Never used'} ·{' '}
                {fmtNumber(feed.key.requestCount)} requests
              </span>
            </div>
          ) : (
            <p className="flex h-9 items-center text-xs text-muted">Generate a key to start pulling properties.</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={cx('btn btn-sm', feed.key ? 'btn-outline' : 'btn-dark')} disabled={busy} onClick={generate}>
          <Icon name={feed.key ? 'arrow-repeat' : 'key'} />
          {feed.key ? 'Rotate key' : 'Generate API key'}
        </button>
        {feed.key && (
          <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={busy} onClick={revoke}>
            <Icon name="shield-x" />
            Revoke
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm ml-auto"
          aria-expanded={docsOpen}
          aria-controls="feed-docs"
          onClick={() => setDocsOpen(!docsOpen)}
        >
          <Icon name="code-slash" />
          {docsOpen ? 'Hide developer guide' : 'Developer guide'}
        </button>
      </div>

      {docsOpen && (
        <div id="feed-docs" className="mt-4 space-y-4 border-t border-line pt-4 text-[13px] text-text">
          <div>
            <p className="font-semibold text-ink">Request</p>
            <pre className="mt-2 overflow-x-auto rounded bg-ink p-3 font-mono text-[12px] leading-[1.6] text-white">{sample}</pre>
            <p className="mt-2 text-xs text-muted">
              Send the key as <code>Authorization: Bearer &lt;key&gt;</code> or <code>X-API-Key: &lt;key&gt;</code>. Keep
              it on your server — anyone with the key can read your feed. Limit: 120 requests per minute.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Query parameters (all optional)</p>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[150px_1fr]">
              {[
                ['purpose', 'sale or rent'],
                ['type', 'Comma list, e.g. Apartment,Villa'],
                ['category', 'residential, commercial or land'],
                ['completion', 'ready or offplan'],
                ['emirate / area', 'Exact emirate; area or community contains text'],
                ['q', 'Search title, reference, area and description'],
                ['minPrice / maxPrice', 'AED'],
                ['minBeds / maxBeds', '0 = studio'],
                ['updatedSince', 'ISO date — pull only changes for incremental syncs'],
                ['ids', 'Comma list of IDs or reference numbers'],
                ['sort', 'newest (default), updated, price_asc, price_desc'],
                ['page / limit', `Pagination, limit 1–${FEED_PAGE_LIMIT} (default ${FEED_DEFAULT_LIMIT})`],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-mono text-ink">{k}</dt>
                  <dd className="text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="font-semibold text-ink">Response</p>
            <p className="mt-1 text-xs text-muted">
              <code>{'{ data: Property[], meta: { total, page, limit, pages, generatedAt }, links: { self, next, prev } }'}</code>.
              Each property has id, reference, url, title, purpose, type, completion, price {'{ amount, currency, onRequest, frequency }'},
              bedrooms, bathrooms, size, location, description, highlights, amenities, featuredImage, images, permit,
              offplan, contact, brokers, enquiry, createdAt and updatedAt. One property: <code>GET {'{endpoint}'}/&lt;id or reference&gt;</code>.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Enquiries</p>
            <p className="mt-1 text-xs text-muted">
              The feed has no broker phone numbers or emails. Show each property&apos;s enquiry form by pasting{' '}
              <code>enquiry.embedHtml</code> (an iframe) on its page. Enquiries sent from it go to the property&apos;s broker on Emirate08, marked with your feed. To size
              the frame automatically, listen for <code>message</code> events with <code>type: &apos;emirate08:enquiry-height&apos;</code>{' '}
              and set the iframe height to <code>event.data.height</code>.
            </p>
          </div>
        </div>
      )}

      <Modal open={!!newKey} onClose={() => setNewKey('')} labelledBy="new-key-title" panelClassName="p-6">
        <h2 id="new-key-title" className="h3">
          Your new API key
        </h2>
        <p className="mt-2 text-[13px] text-muted">
          Copy it now and store it securely. For your security it won’t be shown again — if you lose it, rotate the key.
        </p>
        <div className="mt-4">
          <CopyField id="new-api-key" label="API key" value={newKey} />
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn btn-dark" onClick={() => setNewKey('')}>
            I’ve saved it
          </button>
        </div>
      </Modal>
    </section>
  );
}

/** Property Feed API: choose which published properties your website pulls through the API (independent brokers). */
export function PropertyFeed() {
  useStoreVersion();
  const listings = usePublicListings();
  const feed = useFeed();
  const { user, role } = useSession();
  const isAgency = role === 'agency';
  const { toast, confirm } = useFeedback();
  const [f, setF] = useState(BLANK);
  const [searchText, setSearchText] = useState('');
  // The tester's key lives in memory only; a freshly generated or rotated key is filled in automatically.
  const [testKey, setTestKey] = useState('');
  // Paging and row picks belong to one filter combination; changing a filter starts both afresh.
  const fKey = JSON.stringify(f);
  const [paging, setPaging] = useState({ key: fKey, shown: PAGE, picked: {} as Record<string, boolean> });
  const current = paging.key === fKey ? paging : { key: fKey, shown: PAGE, picked: {} };
  const { shown, picked } = current;
  const setShown = (n: number) => setPaging({ ...current, shown: n });
  const setPicked = (next: Record<string, boolean>) => setPaging({ ...current, picked: next });

  useEffect(() => {
    loadFeed();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setF((cur) => (cur.search === searchText.trim() ? cur : { ...cur, search: searchText.trim() })), 150);
    return () => clearTimeout(t);
  }, [searchText]);

  const published = useMemo(() => listings.filter((n) => n.available), [listings]);
  const types = useMemo(() => [...new Set(published.map((n) => n.type).filter(Boolean))].sort(), [published]);
  const areas = useMemo(() => [...new Set(published.map((n) => n.area).filter(Boolean))].sort(), [published]);
  const inCount = published.filter((n) => isInFeed(feed.config, n.id)).length;

  const rows = published
    .filter((n) => {
      const on = isInFeed(feed.config, n.id);
      if (f.view === 'in' && !on) return false;
      if (f.view === 'out' && on) return false;
      if (f.purpose && n.purpose !== f.purpose) return false;
      if (f.type && n.type !== f.type) return false;
      if (f.completion && n.completion !== f.completion) return false;
      if (f.area && n.area !== f.area) return false;
      if (f.source && sourceOf(n, user) !== f.source) return false;
      if (f.beds) {
        const b = Number(f.beds);
        if (b >= 4 ? Number(n.beds) < 4 : Number(n.beds) !== b) return false;
      }
      if (f.search) {
        const hay = [n.title, n.area, n.community, n.ref, n.type, n.broker?.name, n.developerName, agencyOf(n)].join(' ').toLowerCase();
        if (!hay.includes(f.search.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '') || 0);

  const pickedIds = Object.keys(picked).filter((id) => picked[id]);
  const filtered = Object.entries(f).some(([k, v]) => k !== 'view' && v !== '');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const reset = () => {
    setF(BLANK);
    setSearchText('');
  };

  const run = async (ids, include, label) => {
    if (!ids.length) return;
    const ok = await (include ? includeInFeed(ids) : excludeFromFeed(ids));
    setPicked({});
    if (ok) toast(label, { icon: include ? 'plus-circle' : 'dash-circle' });
    else toast(feedStore.getState().error || 'The feed could not be updated. Try again.', { icon: 'exclamation-circle' });
  };
  const bulkMatching = async (include) => {
    const ids = rows.filter((n) => isInFeed(feed.config, n.id) !== include).map((n) => String(n.id));
    if (!ids.length) return;
    if (!include) {
      const ok = await confirm({
        title: `Remove ${fmtNumber(ids.length)} properties from your feed?`,
        body: 'Websites using your API key will stop showing them on their next sync. You can add them back at any time.',
        ok: 'Remove',
        danger: true,
      });
      if (!ok) return;
    }
    run(ids, include, `${include ? 'Added' : 'Removed'} ${fmtNumber(ids.length)} properties ${include ? 'to' : 'from'} your feed.`);
  };
  const setAuto = async (value) => {
    const ok = await changeFeed({ action: 'settings', autoIncludeNew: value });
    if (!ok) toast(feedStore.getState().error || 'The setting could not be saved.', { icon: 'exclamation-circle' });
  };
  const resetAll = async () => {
    const ok = await confirm({
      title: 'Include every published property?',
      body: 'This clears your removals and turns on automatic inclusion of new properties.',
      ok: 'Include all',
    });
    if (ok && (await changeFeed({ action: 'reset' }))) toast('All published properties are in your feed.', { icon: 'check2-circle' });
  };

  if (feed.status === 'idle' || feed.status === 'loading') {
    return (
      <div className="mx-auto max-w-[1100px]" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-mist" />
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-mist" />
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-mist" />
      </div>
    );
  }
  if (feed.status !== 'ready') {
    return (
      <div className="mx-auto max-w-[640px] rounded-lg border border-dashed border-line bg-white p-10 text-center">
        <Icon name={feed.status === 'unavailable' ? 'lock' : 'exclamation-circle'} className="mx-auto h-6 w-6 text-muted" />
        <p className="mt-3 font-display text-[16px] font-semibold text-ink">
          {feed.status === 'unavailable' ? 'Available to independent brokers and agency admins' : 'The property feed could not be loaded'}
        </p>
        <p className="mt-1 text-[13px] text-muted">{feed.error}</p>
        {feed.status === 'error' && (
          <button type="button" className="btn btn-outline btn-sm mt-4" onClick={() => loadFeed(true)}>
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h2 text-[24px] lg:text-[28px]">Property Feed API</h1>
          <p className="mt-1 max-w-[620px] text-[14px] text-muted">
            Show Emirate08 published properties on your own website. Every published property is in your feed by
            default — remove the ones you don’t want to share.
          </p>
        </div>
        {/* The broker network is a broker-only workspace; agencies manage their feed from this page alone. */}
        {!isAgency && (
          <Link href="/network" className="btn btn-outline">
            <Icon name="diagram-3" />
            Browse network
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4 sm:col-span-2">
          <p className="text-xs text-muted">In your feed</p>
          <p className="mt-1 font-display text-[24px] leading-none font-semibold text-ink">
            {fmtNumber(inCount)} <span className="text-[15px] font-normal text-muted">/ {fmtNumber(published.length)} published</span>
          </p>
          <div className="meter mt-3">
            <span style={{ width: (published.length ? (inCount / published.length) * 100 : 0) + '%' }} />
          </div>
          {inCount < published.length && (
            <button type="button" className="arrow-link mt-2 text-xs" onClick={resetAll}>
              Include all published properties
              <Icon name="arrow-right" />
            </button>
          )}
        </div>
        <div className="card p-4">
          <Switch
            id="feed-auto"
            checked={feed.config.autoIncludeNew}
            onChange={setAuto}
            label="Auto-include new listings"
            description={
              feed.config.autoIncludeNew
                ? 'Newly published properties join your feed automatically.'
                : 'New properties stay out until you add them.'
            }
            className=""
          />
        </div>
      </div>

      <div className="mt-4">
        <ApiAccess inFeedCount={inCount} onNewKey={setTestKey} />
      </div>
      <div className="mt-4">
        <FeedTester apiKey={testKey} onKeyChange={setTestKey} hasKey={!!feed.key} />
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-lg border border-line bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="Feed status">
            {[
              ['all', 'All', published.length],
              ['in', 'In feed', inCount],
              ['out', 'Removed', published.length - inCount],
            ].map(([v, l, n]) => (
              <button key={v} type="button" aria-pressed={f.view === v} onClick={() => setF({ ...f, view: v as string })}>
                {l} <span className="text-muted">{fmtNumber(n)}</span>
              </button>
            ))}
          </div>
          <div className="relative min-w-[200px] flex-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <label htmlFor="pf-search" className="sr-only">
              Search properties
            </label>
            <input
              id="pf-search"
              type="search"
              className="input input-sm h-9 pl-9"
              placeholder="Search title, area, reference, broker or agency"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['purpose', 'Purpose', [['', 'Sale & rent'], ['sale', 'For sale'], ['rent', 'For rent']]],
            ['source', 'Source', [['', 'All sources'], ['mine', isAgency ? 'Our agency’s listings' : 'My listings'], ['network', 'Other brokers & agencies'], ['developer', 'Developers']]],
            ['type', 'Type', [['', 'All types'], ...types.map((t) => [t, t])]],
            ['area', 'Area', [['', 'All areas'], ...areas.map((a) => [a, a])]],
            ['beds', 'Bedrooms', [['', 'Any beds'], ['0', 'Studio'], ['1', '1 bed'], ['2', '2 beds'], ['3', '3 beds'], ['4', '4+ beds']]],
            ['completion', 'Completion', [['', 'Ready & off-plan'], ['ready', 'Ready'], ['offplan', 'Off-plan']]],
          ].map(([key, label, opts]) => (
            <div key={key as string}>
              <label htmlFor={'pf-' + key} className="sr-only">
                {label as string}
              </label>
              <select id={'pf-' + key} className="select input-sm h-9" value={f[key as string]} onChange={set(key)}>
                {(opts as string[][]).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
          <span className="text-muted" role="status">
            {fmtNumber(rows.length)} {rows.length === 1 ? 'property' : 'properties'}
            {filtered ? ' match' : ''}
          </span>
          {filtered && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Clear filters
            </button>
          )}
          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" disabled={!rows.some((n) => !isInFeed(feed.config, n.id))} onClick={() => bulkMatching(true)}>
              <Icon name="plus-circle" />
              Add all {filtered ? 'matching' : ''}
            </button>
            <button type="button" className="btn btn-outline btn-sm text-danger" disabled={!rows.some((n) => isInFeed(feed.config, n.id))} onClick={() => bulkMatching(false)}>
              <Icon name="dash-circle" />
              Remove all {filtered ? 'matching' : ''}
            </button>
          </span>
        </div>
      </div>

      {/* Rows */}
      <div className="mt-4 space-y-2" aria-live="polite">
        {rows.length ? (
          rows.slice(0, shown).map((n) => {
            const on = isInFeed(feed.config, n.id);
            const id = String(n.id);
            const source = sourceOf(n, user);
            return (
              <article key={id} className={cx('card flex items-center gap-3 p-3', !on && 'bg-mist/30')}>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#142326]"
                  aria-label={'Choose ' + n.title}
                  checked={!!picked[id]}
                  onChange={(e) => setPicked({ ...picked, [id]: e.target.checked })}
                />
                <Link href={isAgency ? listingUrl(n) : netUrl(n.id)} className="relative block h-16 w-20 shrink-0 overflow-hidden rounded bg-mist">
                  <img src={n.images?.[0] || n.featured || ''} alt="" className={cx('img-cover', !on && 'opacity-60 grayscale')} loading="lazy" />
                </Link>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-semibold text-ink">
                    <Link href={isAgency ? listingUrl(n) : netUrl(n.id)} className="hover:underline">
                      {n.title}
                    </Link>
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {[n.area, n.emirate].filter(Boolean).join(', ')} · <SpecLine n={n} />
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                    <span className="font-semibold text-ink">{fmtPrice(n)}</span>
                    <span className="text-muted">
                      {source === 'mine' ? (
                        <span className="badge badge-sage">{isAgency ? 'Our listing' : 'My listing'}</span>
                      ) : (
                        <>
                          {n.broker?.name || n.developerName || (n as any).owner?.name || 'Developer'} · {source === 'developer' ? 'Developer' : agencyOf(n)}
                        </>
                      )}
                    </span>
                  </p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs" htmlFor={'pf-on-' + id}>
                  <span className={cx('hidden font-semibold sm:inline', on ? 'text-ink' : 'text-muted')}>{on ? 'In feed' : 'Removed'}</span>
                  <span className="relative">
                    <input
                      id={'pf-on-' + id}
                      type="checkbox"
                      className="peer sr-only"
                      checked={on}
                      aria-label={(on ? 'Remove ' : 'Add ') + n.title + (on ? ' from' : ' to') + ' your feed'}
                      onChange={(e) =>
                        run([id], e.target.checked, e.target.checked ? 'Added to your feed.' : 'Removed from your feed.')
                      }
                    />
                    <span className="toggle" aria-hidden="true" />
                  </span>
                </label>
              </article>
            );
          })
        ) : published.length ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="font-display text-[16px] font-semibold text-ink">Nothing matches these filters</p>
            <button type="button" className="btn btn-outline btn-sm mt-4" onClick={reset}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <Icon name="buildings" className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-3 font-display text-[16px] font-semibold text-ink">No published properties yet</p>
            <p className="mt-1 text-[13px] text-muted">Published properties will appear here and in your feed automatically.</p>
          </div>
        )}
        {rows.length > shown && (
          <div className="pt-2 text-center">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShown(shown + PAGE)}>
              Show more ({fmtNumber(rows.length - shown)} left)
            </button>
          </div>
        )}
      </div>

      {/* Bulk bar */}
      {pickedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 lg:pl-[224px]">
          <div className="flex w-full max-w-[600px] flex-wrap items-center gap-2 rounded-lg bg-ink px-4 py-3 text-white shadow-pop">
            <Icon name="list-check" className="h-5 w-5 text-sage" />
            <p className="flex-1 text-[13px] font-semibold" role="status">
              {pickedIds.length} chosen
            </p>
            <button type="button" className="btn btn-sm text-white/80 hover:text-white" onClick={() => setPicked({})}>
              Clear
            </button>
            <button type="button" className="btn btn-sm border border-white/30 text-white" onClick={() => run(pickedIds, false, `Removed ${pickedIds.length} from your feed.`)}>
              <Icon name="dash-circle" />
              Remove
            </button>
            <button type="button" className="btn btn-sage btn-sm" onClick={() => run(pickedIds, true, `Added ${pickedIds.length} to your feed.`)}>
              <Icon name="plus-circle" />
              Add to feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
