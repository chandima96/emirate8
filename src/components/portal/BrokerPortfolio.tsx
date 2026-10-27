'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/broker/Avatar';
import { ContactButtons } from '@/components/broker/ContactButtons';
import { PropertyHCard } from '@/components/property/PropertyHCard';
import { useSession } from '@/components/providers/SessionProvider';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  broker,
  brokerPreview,
  brokerStats,
  brokerUrl,
  fmtCompact,
  isHistory,
  isPublic,
  listingsFor,
} from '@/lib/store';
import { absUrl, copyText, share } from '@/lib/share';
import { EmptyState } from './EmptyState';

const PREFERRED = { whatsapp: 'WhatsApp', call: 'phone call', email: 'email' };

function SkeletonBone({ className = '' }) {
  return <div className={`rounded bg-line/60 ${className}`} />;
}

export function BrokerPortfolioSkeleton() {
  return (
    <div className="wrap py-5 sm:py-6" role="status" aria-busy="true">
      <span className="sr-only">Loading portfolio…</span>
      <div className="motion-safe:animate-pulse">
        <SkeletonBone className="h-48 w-full rounded-lg sm:h-64" />
        <div className="relative px-1 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <SkeletonBone className="-mt-12 h-28 w-28 shrink-0 rounded-full ring-4 ring-white sm:-mt-16" />
            <div className="w-full space-y-3 pb-2">
              <SkeletonBone className="h-7 w-2/3" />
              <SkeletonBone className="h-4 w-1/2" />
              <SkeletonBone className="h-3 w-1/3" />
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <SkeletonBone className="h-10 w-full" />
              <SkeletonBone className="h-52 w-full rounded-lg" />
              <SkeletonBone className="h-52 w-full rounded-lg" />
            </div>
            <div className="space-y-4">
              <SkeletonBone className="h-44 w-full rounded-lg" />
              <SkeletonBone className="h-64 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function decode(s) {
  try {
    return decodeURIComponent(s || '');
  } catch {
    return s || '';
  }
}

/** /brokers/[slug] — Bayut-style public portfolio. `me` = the signed-in broker; ?preview=draft shows the unsaved draft; ?embed=1 hides the chrome. */
export function BrokerPortfolio({ initialBroker = null, initialListings = [] }) {
  const { ready, user: u } = useSession();
  useStoreVersion();
  const params = useParams();
  const sp = useSearchParams();
  const slug = decode(params.slug);
  const embed = !!sp.get('embed');

  useEffect(() => {
    if (!embed) return undefined;
    const el = document.documentElement;
    el.classList.add('is-embed');
    return () => el.classList.remove('is-embed');
  }, [embed]);

  if (!ready && !initialBroker) return <BrokerPortfolioSkeleton />;

  let b = ready ? broker(slug === 'me' && u ? u.id : slug) : initialBroker;
  const owner = !!(b && u && b.id === u.id);
  const previewDraft = owner && sp.get('preview') === 'draft';
  if (previewDraft) b = brokerPreview(u);

  if (!b || (!b.isPublic && !owner))
    return (
      <div className="wrap py-20 text-center">
        <Icon name="person" className="mx-auto h-8 w-8 text-muted" />
        <h1 className="h2 mt-4">This broker profile isn’t available</h1>
        <p className="mt-2 text-[14px] text-muted">The profile may be private, or the link may be incomplete.</p>
        <Link href="/agents" className="btn btn-dark mt-6">
          Find an agent
        </Link>
      </div>
    );

  return (
    <Portfolio
      key={b.id + (previewDraft ? ':draft' : '')}
      b={b}
      owner={owner}
      previewDraft={previewDraft}
      initialListings={initialListings}
    />
  );
}

function Portfolio({ b, owner, previewDraft, initialListings }) {
  const { toast } = useFeedback();
  const agencyAccount = b.type === 'agency';
  const liveListings = listingsFor(b.id);
  const mine = liveListings.length ? liveListings : initialListings;
  const active = mine.filter(isPublic);
  const history = b.showClosed ? mine.filter(isHistory) : [];
  const st = brokerStats(b);
  const url = brokerUrl(b);
  const first = b.name.split(' ')[0];
  const bio = b.bio || b.intro || '';
  const longBio = bio.length > 360;
  const showTx = b.showTransactions !== false;

  const [clamped, setClamped] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const initialSort = ['newest', 'priceAsc', 'priceDesc'].includes(b.defaultSort) ? b.defaultSort : 'relevant';
  const [f, setF] = useState({
    purpose: 'all',
    dev: '',
    type: '',
    loc: '',
    price: '',
    beds: '',
    sort: initialSort,
    tab: 'active',
    limit: 10,
  });
  const set = (patch) => setF((s) => ({ ...s, ...patch, limit: 10 }));
  const resetFilters = () => setF((s) => ({ ...s, purpose: 'all', dev: '', type: '', loc: '', price: '', beds: '' }));
  const urlInput = useRef(null);

  useDocumentTitle(`${b.name} — ${b.title || (agencyAccount ? 'Real estate agency' : 'Real estate broker')} · Emirate08`);

  /* Filters */
  const areas = [];
  active.concat(history).forEach((l) => {
    if (!areas.includes(l.area)) areas.push(l.area);
  });
  const types = [];
  active.forEach((l) => {
    if (!types.includes(l.type)) types.push(l.type);
  });
  const order = b.featuredOrder || [];
  const rank = (l) => {
    const i = order.indexOf(l.id);
    return i > -1 ? i : l.display.portfolioFeatured ? 50 : 100;
  };
  const sorts = {
    relevant: (a, c) => rank(a) - rank(c) || a.listed - c.listed,
    newest: (a, c) => a.listed - c.listed,
    priceAsc: (a, c) => a.price - c.price,
    priceDesc: (a, c) => c.price - a.price,
  };
  const src = f.tab === 'history' ? history : active;
  const items = src
    .filter((l) => {
      if (f.purpose !== 'all' && l.purpose !== f.purpose) return false;
      if (f.dev && l.completion !== f.dev) return false;
      if (f.type && l.type !== f.type) return false;
      if (f.loc && l.area !== f.loc) return false;
      if (f.beds !== '') {
        const bb = +f.beds;
        if (bb >= 4 ? l.beds < 4 : +l.beds !== bb) return false;
      }
      if (f.price) {
        const r = f.price.split('-').map(Number);
        if (l.price < r[0] || (r[1] && l.price > r[1])) return false;
      }
      return true;
    })
    .sort(sorts[f.sort]);
  const shown = items.slice(0, f.limit);

  const statLine = [
    <span key="a">
      <b className="font-semibold text-ink">{st.active}</b> active propert{st.active === 1 ? 'y' : 'ies'}
    </span>,
    showTx && !!st.sold && (
      <span key="s">
        <b className="font-semibold text-ink">{st.sold}</b> sale{st.sold === 1 ? '' : 's'} recorded
      </span>
    ),
    showTx && !!st.rented && (
      <span key="r">
        <b className="font-semibold text-ink">{st.rented}</b> rental{st.rented === 1 ? '' : 's'} recorded
      </span>
    ),
    !agencyAccount && !!b.experience && (
      <span key="e">
        <b className="font-semibold text-ink">{b.experience}</b> years’ experience
      </span>
    ),
  ].filter(Boolean);

  const credBadges = (b.credentials || []).filter((c) => c.verified);
  const otherCreds = (b.credentials || []).filter((c) => !/BRN/.test(c.label));
  const sideStats = [
    ['Active listings', st.active],
    ['For sale', st.sale],
    ['For rent', st.rent],
    ['Off-plan', st.offplan],
  ];
  const txRows = showTx
    ? [
        ['Sales recorded', st.sold],
        ['Rentals recorded', st.rented],
        ['Recorded sale value', st.soldValue ? fmtCompact(st.soldValue) : ''],
        ['Recorded rental value', st.rentedValue ? fmtCompact(st.rentedValue) + ' /yr' : ''],
      ].filter((r) => r[1])
    : [];

  const sel = (id, label, key, options) => (
    <div className="min-w-0">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="select h-10 text-[13px]"
        value={f[key]}
        onChange={(e) => set({ [key]: e.target.value })}
      >
        {options}
      </select>
    </div>
  );

  const copyLink = () =>
    copyText(urlInput.current.value).then(
      () => toast('Profile link copied.', { icon: 'link-45deg' }),
      () => urlInput.current.select(),
    );

  return (
    <div>
      {owner && (
        <div className="wrap pt-4">
          <div
            className={
              'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-[13px] ' +
              (previewDraft ? 'border-warn/30 bg-warn-soft text-warn' : 'border-line bg-white text-text')
            }
          >
            <p>
              <Icon name={previewDraft ? 'eye' : 'person-badge'} className="mr-1.5 h-4 w-4" />
              {previewDraft ? (
                <>
                  <b>Preview mode</b> — unpublished profile changes are shown. Buyers still see your published profile.
                </>
              ) : (
                <>
                  This is your public portfolio as buyers see it.
                  {!b.isPublic && (
                    <>
                      {' '}
                      <b>It is currently private.</b>
                    </>
                  )}
                </>
              )}
            </p>
            <Link className="font-semibold underline underline-offset-4" href="/profile">
              {previewDraft ? 'Back to editing' : 'Edit portfolio'}
            </Link>
          </div>
        </div>
      )}

      {/* Header: cover, photo, identity, contact */}
      <div className="wrap pt-5 sm:pt-6">
        <div
          className="cover"
          style={{ '--pos': (b.coverPos == null ? 50 : b.coverPos) + '%' } as import('react').CSSProperties}
        >
          {b.cover && (
            <img
              src={b.cover}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: 'center var(--pos)' }}
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-ink-deep/45 via-ink-deep/5 to-transparent" />
          <span className="absolute top-4 right-4 rounded-sm bg-white/95 px-2 py-1 text-2xs font-semibold tracking-[.1em] text-ink uppercase">
            {agencyAccount ? 'Real estate agency' : b.independent ? 'Independent broker' : b.agencyName}
          </span>
        </div>
        <div className="relative px-1 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
              <div className="pf-avatar -mt-12 shrink-0 sm:-mt-20">
                <Avatar person={b} size={148} square={agencyAccount} className="shadow-card ring-[5px] ring-white" />
              </div>
              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">
                    {b.name}
                  </h1>
                  {b.brnVerified && (
                    <span className="badge badge-ok">
                      <Icon name="patch-check-fill" className="h-3 w-3" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[14px] text-text">
                  {b.title || (agencyAccount ? 'Real estate agency' : 'Real estate broker')}
                  {b.agencyName && (
                    <>
                      {' · '}
                      <span className="font-semibold">
                        {b.agency && b.agency.website ? (
                          <a
                            className="underline underline-offset-4"
                            href={b.agency.website}
                            target="_blank"
                            rel="noopener"
                          >
                            {b.agencyName}
                          </a>
                        ) : (
                          b.agencyName
                        )}
                      </span>
                    </>
                  )}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
                  <Icon name="geo-alt" className="h-3.5 w-3.5" />
                  {b.location || 'Dubai, UAE'}
                  {b.headline && (
                    <>
                      <span className="mx-1 text-line">·</span>
                      <span className="text-text">{b.headline}</span>
                    </>
                  )}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                  {statLine.map((s, i) => (
                    <Fragment key={i}>
                      {i > 0 && (
                        <span className="text-line" aria-hidden="true">
                          |
                        </span>
                      )}
                      {s}
                    </Fragment>
                  ))}
                </div>
                {!!credBadges.length && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {credBadges.map((c) => (
                      <span key={c.label} className="badge badge-ok">
                        <Icon name="patch-check-fill" className="h-3 w-3" />
                        {/BRN/.test(c.label) ? 'RERA BRN verified' : c.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end lg:pb-1">
              <ContactButtons broker={b} />
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => share(b.name + ' on Emirate08', url, toast)}
              >
                <Icon name="share" />
                Share profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="wrap mt-8">
        <section className="rounded-lg bg-mist p-5 sm:p-7" aria-labelledby="h-about">
          <h2 id="h-about" className="h4">
            {agencyAccount ? 'About the agency' : `About ${first}`}
          </h2>
          {bio ? (
            <>
              <div
                id="pf-bio"
                className={
                  'readmore mt-3 space-y-3 text-[14px] leading-[1.7] text-text' +
                  (longBio && clamped ? ' is-clamped' : '')
                }
              >
                {bio.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>
                    {p.split('\n').map((line, j) => (
                      <Fragment key={j}>
                        {j > 0 && <br />}
                        {line}
                      </Fragment>
                    ))}
                  </p>
                ))}
              </div>
              {longBio && (
                <button
                  type="button"
                  className="mt-2 text-[13px] font-semibold text-ink underline underline-offset-4"
                  aria-expanded={!clamped}
                  aria-controls="pf-bio"
                  onClick={() => setClamped((c) => !c)}
                >
                  {clamped ? 'Read more' : 'Read less'}
                </button>
              )}
            </>
          ) : (
            <p className="mt-3 text-[14px] text-muted">{agencyAccount ? 'This agency has not added an overview yet.' : `${first} hasn’t added a biography yet.`}</p>
          )}
          <dl className="mt-5 grid gap-4 border-t border-line pt-5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="flex items-center gap-1.5 font-semibold text-ink">
                <Icon name="stars" className="h-3.5 w-3.5" />
                Specialisations
              </dt>
              <dd className="mt-1 text-text">{(b.specialties || []).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 font-semibold text-ink">
                <Icon name="geo-alt" className="h-3.5 w-3.5" />
                Service areas
              </dt>
              <dd className="mt-1 text-text">{(b.areas || []).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 font-semibold text-ink">
                <Icon name="translate" className="h-3.5 w-3.5" />
                {agencyAccount ? 'Agency services' : 'Languages'}
              </dt>
              <dd className="mt-1 text-text">{agencyAccount ? ((b.specialties || []).join(', ') || '—') : ((b.languages || []).join(', ') || '—')}</dd>
            </div>
            {!agencyAccount && <div>
              <dt className="flex items-center gap-1.5 font-semibold text-ink">
                <Icon name="briefcase" className="h-3.5 w-3.5" />
                {agencyAccount ? 'On Emirate08 since' : 'Experience'}
              </dt>
              <dd className="mt-1 text-text">
                {agencyAccount ? (b.since || '—') : `${b.experience ? b.experience + ' years' : '—'} · on Emirate08 since ${b.since || ''}`}
              </dd>
            </div>}
          </dl>
        </section>
      </div>

      {agencyAccount && (
        <section className="wrap mt-8" aria-labelledby="h-team">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="h-team" className="h3">Our team</h2>
              <p className="mt-1 text-[13px] text-muted">Meet the brokers working with {b.name}.</p>
            </div>
            {!!b.team?.length && <span className="text-[13px] text-muted">{b.team.length} {b.team.length === 1 ? 'broker' : 'brokers'}</span>}
          </div>
          {b.team?.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {b.team.map((member) => {
                const card = (
                  <div className="flex items-center gap-4 rounded-lg border border-line bg-white p-4 transition-colors hover:border-ink/30">
                    <Avatar person={member} size={64} className="shrink-0" />
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-semibold text-ink">{member.name}</h3>
                      <p className="mt-1 text-[12px] text-muted">{member.title || 'Real estate broker'}</p>
                      {!!member.specialties?.length && <p className="mt-1 truncate text-[12px] text-text">{member.specialties.slice(0, 2).join(' · ')}</p>}
                    </div>
                    {member.slug && <Icon name="box-arrow-up-right" className="ml-auto h-4 w-4 shrink-0 text-muted" />}
                  </div>
                );
                return member.slug ? <Link key={member.id} href={brokerUrl({ slug: member.slug })}>{card}</Link> : <div key={member.id}>{card}</div>;
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-line bg-white p-5 text-[13px] text-muted">The agency team will appear here when brokers have joined and made their profiles public.</p>
          )}
        </section>
      )}

      {/* Listings + sidebar */}
      <div className="wrap mt-10 pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="h-props">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="h-props" className="h3">
                {f.tab === 'history' ? 'Sold & rented' : agencyAccount ? 'Agency properties' : 'Active properties'}
              </h2>
              {!!history.length && (
                <div className="flex border-b border-line" role="tablist" aria-label="Listing history">
                  <button
                    type="button"
                    className="tab"
                    role="tab"
                    aria-selected={f.tab === 'active'}
                    onClick={() => set({ tab: 'active' })}
                  >
                    Active ({active.length})
                  </button>
                  <button
                    type="button"
                    className="tab"
                    role="tab"
                    aria-selected={f.tab === 'history'}
                    onClick={() => set({ tab: 'history' })}
                  >
                    Sold &amp; rented ({history.length})
                  </button>
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Listing filters">
                <div className="seg" role="group" aria-label="Purpose">
                  {[
                    ['all', 'All'],
                    ['sale', 'For sale'],
                    ['rent', 'For rent'],
                  ].map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={f.purpose === v} onClick={() => set({ purpose: v })}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="seg" role="group" aria-label="Development status">
                  {[
                    ['', 'Any'],
                    ['ready', 'Ready'],
                    ['offplan', 'Off-plan'],
                  ].map(([v, l]) => (
                    <button key={l} type="button" aria-pressed={f.dev === v} onClick={() => set({ dev: v })}>
                      {l}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm h-10 md:hidden"
                  aria-expanded={moreOpen}
                  aria-controls="pf-more"
                  onClick={() => setMoreOpen((o) => !o)}
                >
                  <Icon name="sliders" />
                  More filters
                </button>
              </div>
              <div
                id="pf-more"
                className={'pf-more mt-2 grid-cols-2 gap-2 md:grid-cols-5' + (moreOpen ? ' is-open' : '')}
              >
                {sel(
                  'pf-type',
                  'Property type',
                  'type',
                  <>
                    <option value="">Property type</option>
                    {types.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </>,
                )}
                {sel(
                  'pf-loc',
                  'Location',
                  'loc',
                  <>
                    <option value="">Location</option>
                    {areas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </>,
                )}
                {sel(
                  'pf-price',
                  'Price range',
                  'price',
                  <>
                    <option value="">Price (AED)</option>
                    <option value="0-200000">Under 200K</option>
                    <option value="200000-1000000">200K – 1M</option>
                    <option value="1000000-3000000">1M – 3M</option>
                    <option value="3000000-10000000">3M – 10M</option>
                    <option value="10000000-0">Over 10M</option>
                  </>,
                )}
                {sel(
                  'pf-beds',
                  'Bedrooms',
                  'beds',
                  <>
                    <option value="">Beds</option>
                    <option value="0">Studio</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                  </>,
                )}
                {sel(
                  'pf-sort',
                  'Sort by',
                  'sort',
                  <>
                    <option value="relevant">Most relevant</option>
                    <option value="newest">Newest first</option>
                    <option value="priceAsc">Price: low to high</option>
                    <option value="priceDesc">Price: high to low</option>
                  </>,
                )}
              </div>
            </div>
            <p className="mt-4 text-[13px] text-muted" aria-live="polite">
              {items.length
                ? `Showing 1–${shown.length} of ${items.length} propert${items.length === 1 ? 'y' : 'ies'}${
                    f.tab === 'history' ? ' (sold & rented)' : ''
                  }`
                : ''}
            </p>
            <div className="mt-3 grid gap-4">
              {shown.length ? (
                shown.map((l) => <PropertyHCard key={l.id} listing={l} />)
              ) : (
                <EmptyState
                  title={
                    src.length
                      ? 'No properties match these filters'
                      : f.tab === 'history'
                        ? 'No completed transactions yet'
                        : first + ' has no active listings right now'
                  }
                  text={
                    src.length ? 'Try clearing a filter.' : 'Contact ' + first + ' to hear about new properties first.'
                  }
                >
                  {!!src.length && (
                    <button type="button" className="btn btn-outline btn-sm mt-4" onClick={resetFilters}>
                      Clear filters
                    </button>
                  )}
                </EmptyState>
              )}
            </div>
            <div className="mt-6 text-center">
              {items.length > shown.length && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setF((s) => ({ ...s, limit: s.limit + 10 }))}
                >
                  Show more properties
                </button>
              )}
            </div>
          </section>

          <aside className="space-y-4" aria-label={agencyAccount ? 'About the agency' : 'About the broker'}>
            <section className="card p-5">
              <h2 className="text-[14px] font-semibold text-ink">Performance summary</h2>
              <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line">
                {sideStats.map(([k, v]) => (
                  <div key={k} className="bg-white p-3">
                    <dt className="text-2xs tracking-[.08em] text-muted uppercase">{k}</dt>
                    <dd className="mt-1 font-display text-[20px] font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {txRows.length ? (
                <>
                  <dl className="mt-3 space-y-1.5 text-[13px]">
                    {txRows.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-semibold text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-2xs text-muted">
                    Counted from listings marked sold or rented on Emirate08 only.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-2xs text-muted">
                  Completed transactions appear here once they’re recorded on Emirate08.
                </p>
              )}
            </section>
            <section className="card p-5">
              <h2 className="text-[14px] font-semibold text-ink">{agencyAccount ? 'Agency details' : 'About the broker'}</h2>
              <dl className="mt-3 space-y-3 text-[13px]">
                <div>
                  <dt className="text-muted">Specialisations</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {(b.specialties || []).length
                      ? b.specialties.map((x) => (
                          <span key={x} className="chip">
                            {x}
                          </span>
                        ))
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Service areas</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {(b.areas || []).length
                      ? b.areas.map((x) => (
                          <Link
                            key={x}
                            className="chip hover:border-ink"
                            href={'/properties?q=' + encodeURIComponent(x)}
                          >
                            {x}
                          </Link>
                        ))
                      : '—'}
                  </dd>
                </div>
                {!agencyAccount && !!b.experience && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Experience</dt>
                    <dd className="font-semibold text-ink">{b.experience} years</dd>
                  </div>
                )}
                {!agencyAccount && !!(b.languages || []).length && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Languages</dt>
                    <dd className="text-right font-semibold text-ink">{b.languages.join(', ')}</dd>
                  </div>
                )}
                {agencyAccount ? (b.agency?.orn ? <div className="flex justify-between gap-3"><dt className="text-muted">RERA ORN</dt><dd className="text-right font-semibold text-ink">{b.agency.orn}</dd></div> : null) : <div className="flex justify-between gap-3"><dt className="text-muted">Brokerage</dt><dd className="text-right font-semibold text-ink">{b.agencyName || 'Independent'}</dd></div>}
                {agencyAccount && b.agency?.website && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Website</dt>
                    <dd className="text-right font-semibold text-ink">
                      <a href={b.agency.website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        Visit website
                      </a>
                    </dd>
                  </div>
                )}
                {!agencyAccount && b.brn && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">RERA / BRN</dt>
                    <dd className="text-right font-semibold text-ink">
                      {b.brn.replace(/^BRN /, '')}
                      <span className={'block text-2xs font-normal ' + (b.brnVerified ? 'text-ok' : 'text-muted')}>
                        {b.brnVerified ? 'Verified by Emirate08' : 'Not yet verified'}
                      </span>
                    </dd>
                  </div>
                )}
                {!!otherCreds.length && (
                  <div>
                    <dt className="text-muted">Professional credentials</dt>
                    <dd className="mt-1 space-y-1">
                      {otherCreds.map((c) => (
                        <p key={c.label} className="flex items-start gap-1.5">
                          <Icon
                            name={c.verified ? 'patch-check-fill' : 'circle'}
                            className={'mt-0.5 h-3.5 w-3.5 ' + (c.verified ? 'text-ok' : 'text-muted')}
                          />
                          <span>
                            {c.label}
                            {!c.verified && <span className="text-muted"> (not verified)</span>}
                          </span>
                        </p>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
            <section className="card p-5">
              <h2 className="text-[14px] font-semibold text-ink">{agencyAccount ? 'Contact the agency' : `Contact ${first}`}</h2>
              <p className="mt-1 text-xs text-muted">Preferred: {PREFERRED[b.preferred] || 'any'}</p>
              <div className="mt-3 grid gap-2">
                <ContactButtons broker={b} size="w-full justify-start" />
              </div>
            </section>
            <section className="card p-5">
              <h2 className="text-[14px] font-semibold text-ink">Share this profile</h2>
              <div className="mt-3 flex gap-2">
                <label className="sr-only" htmlFor="pf-url">
                  Profile link
                </label>
                <input
                  ref={urlInput}
                  id="pf-url"
                  className="input h-10 min-w-0 flex-1 text-[12px]"
                  readOnly
                  value={absUrl(url)}
                />
                <button type="button" className="btn btn-dark h-10" onClick={copyLink}>
                  <Icon name="link-45deg" />
                  Copy
                </button>
              </div>
            </section>
          </aside>
        </div>
        <nav className="mt-10 text-[13px] text-muted" aria-label="Breadcrumb">
          <Link className="hover:text-ink" href="/">
            Home
          </Link>
          <span className="mx-1.5">›</span>
              <Link className="hover:text-ink" href="/agents">
            {agencyAccount ? 'Find agencies and agents' : 'Find an agent'}
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-ink">{b.name}</span>
        </nav>
      </div>
    </div>
  );
}
