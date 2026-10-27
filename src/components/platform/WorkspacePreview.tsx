'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { IMG, PIMG } from '@/config/images';
import { cx } from '@/lib/utils';

const TABS = [
  ['listings', 'buildings', 'My Listings', 'Organise active, draft, and completed listings in one place.'],
  ['network', 'diagram-3', 'Broker Network', 'Browse property opportunities published by participating brokers.'],
  ['selected', 'bookmark', 'Selected Properties', 'Save relevant network listings in a private working collection.'],
  [
    'account',
    'person-vcard',
    'Account & Membership',
    'Keep professional details, subscriptions, and account information organised.',
  ],
];
const SIDE = [
  ['overview', 'Overview'],
  ['listings', 'My Listings'],
  ['network', 'Broker Network'],
  ['selected', 'Selected'],
  ['account', 'Subscription'],
];
const LISTINGS = [
  ['prop-marina-interior', 'Modern Marina Residence', 'Dubai Marina · Apartment', 'AED 2,450,000', 'Active'],
  ['prop-villa', 'Contemporary Hills Villa', 'Dubai Hills Estate · Villa', 'AED 7,800,000', 'Active'],
  [
    'prop-waterfront-apartment',
    'Creek Harbour Waterfront Apartment',
    'Dubai Creek Harbour · Apartment',
    'AED 1,950,000',
    'Draft',
  ],
  ['prop-office', 'Business Bay Executive Office', 'Business Bay · Commercial', 'AED 240,000/yr', 'Active'],
];
const NETWORK: [string, string, string, boolean, string?][] = [
  [IMG + 'dubai-marina.webp', 'AED 2,950,000', 'Dubai Marina · 2 bed', true],
  [IMG + 'palm-jumeirah.webp', 'AED 34,500,000', 'Palm Jumeirah · 5 bed', false],
  [PIMG + 'prop-creek-towers.webp', 'AED 1,650,000', 'Creek Harbour · 1 bed', true, 'md'],
  [PIMG + 'prop-canal-residences.webp', 'AED 320,000/yr', 'Business Bay · Office', false],
  [PIMG + 'prop-villa.webp', 'AED 11,800,000', 'Al Barari · 6 bed', false],
  [IMG + 'downtown-dubai.webp', 'AED 210,000/yr', 'Downtown Dubai · 2 bed', false, 'md'],
];

/** "Your Brokerage Workspace" section: vertical tabs driving an HTML/CSS mock of the workspace (sample records). */
export function WorkspacePreview() {
  const [active, setActive] = useState('listings');
  const tabRefs = useRef([]);
  const activate = (i, focus = undefined) => {
    setActive(TABS[i][0]);
    if (focus) tabRefs.current[i]?.focus();
  };
  const onKey = (i) => (e) => {
    let d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (e.key === 'Home') d = -i;
    if (e.key === 'End') d = TABS.length - 1 - i;
    if (d == null) return;
    e.preventDefault();
    activate((i + d + TABS.length) % TABS.length, true);
  };
  const pane = (key) => ({
    id: 'ws-' + key,
    role: 'tabpanel',
    'aria-labelledby': 'ws-tab-' + key,
    className: 'ws-pane',
    'aria-hidden': active !== key,
  });

  return (
    <section id="workspace" className="on-dark overflow-hidden bg-ink py-16 lg:py-[88px]">
      <div className="wrap">
        <div className="grid gap-5 lg:grid-cols-12 lg:items-end" data-reveal>
          <div className="lg:col-span-7">
            <p className="eyebrow">Your Brokerage Workspace</p>
            <h2 className="h2 mt-4 max-w-[560px]">
              Everything You Need. <em className="f font-normal text-sage">Beautifully</em> Organised.
            </h2>
          </div>
          <p className="lead lg:col-span-5 lg:pb-1">
            A single workspace designed to help property professionals manage listings, discover opportunities, and stay
            on top of their business.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4" role="tablist" aria-label="Workspace features" aria-orientation="vertical">
            {TABS.map(([key, icon, title, text], i) => (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={'ws-tab-' + key}
                aria-controls={'ws-' + key}
                aria-selected={active === key}
                tabIndex={active === key ? 0 : -1}
                className="ws-tab relative flex w-full gap-4 rounded-lg px-4 py-4 text-left transition-colors hover:bg-white/5"
                onClick={() => activate(i)}
                onKeyDown={onKey(i)}
              >
                <span className="ws-tab-bar absolute inset-y-3 left-0 w-0.5 bg-sage" />
                <i className={`bi bi-${icon} mt-0.5 h-[18px] w-[18px] shrink-0 text-sage`} aria-hidden="true" />
                <span>
                  <span className="block font-display text-[16px] font-semibold text-white">{title}</span>
                  <span className="mt-1 block text-[13px] leading-[1.55] text-[#A9B4B1]">{text}</span>
                </span>
              </button>
            ))}
            <Link href="/register" className="btn btn-sage mt-6 hidden lg:inline-flex">
              Create your workspace
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>

          {/* Preview: built in HTML/CSS */}
          <div className="lg:col-span-8" data-reveal>
            <div className="overflow-hidden rounded-lg border border-white/10 bg-paper text-text shadow-pop">
              <div className="flex h-9 items-center gap-2 border-b border-line bg-white px-3">
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="mx-auto hidden rounded bg-mist px-10 py-0.5 text-2xs text-muted sm:block">
                  emirate08 · workspace
                </span>
                <span className="demo-tag ml-auto sm:ml-0">Preview</span>
              </div>
              <div className="flex">
                <div className="hidden w-[150px] shrink-0 flex-col gap-1 bg-ink-deep p-3 sm:flex" aria-hidden="true">
                  <span className="mb-2 font-display text-[13px] font-semibold text-white">
                    Emirate<span className="f font-normal">08</span>
                  </span>
                  {SIDE.map(([key, label]) => (
                    <span
                      key={key}
                      className={cx(
                        'rounded px-2 py-1.5 text-2xs',
                        active === key ? 'bg-white/10 text-white' : 'text-[#B9C3C0]',
                      )}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <div className="relative min-h-[392px] flex-1 p-4 sm:p-5">
                  {/* Listings */}
                  <div {...pane('listings')}>
                    <div className="flex items-center justify-between">
                      <p className="font-display text-[15px] font-semibold text-ink">My Listings</p>
                      <span className="btn btn-dark btn-sm pointer-events-none">
                        <i className="bi bi-plus-lg" aria-hidden="true" />
                        Add property
                      </span>
                    </div>
                    <div className="mt-3 flex gap-1 text-2xs font-semibold">
                      <span className="rounded-sm bg-ink px-2 py-1 text-white">All</span>
                      <span className="rounded-sm px-2 py-1 text-muted">Active</span>
                      <span className="rounded-sm px-2 py-1 text-muted">Drafts</span>
                      <span className="rounded-sm px-2 py-1 text-muted">Completed</span>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
                      {LISTINGS.map(([img, title, meta, price, status], i) => (
                        <div
                          key={title}
                          className={cx(
                            'flex items-center gap-3 p-2.5',
                            i < LISTINGS.length - 1 && 'border-b border-line',
                          )}
                        >
                          <img
                            src={PIMG + img + '.webp'}
                            alt=""
                            className="h-10 w-14 rounded object-cover"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-ink">{title}</p>
                            <p className="text-2xs text-muted">{meta}</p>
                          </div>
                          <p className="hidden text-xs font-semibold text-ink sm:block">{price}</p>
                          <span className={cx('badge', status === 'Draft' ? 'badge-muted' : 'badge-ok')}>{status}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-2xs text-muted">Sample records shown for illustration.</p>
                  </div>
                  {/* Network */}
                  <div {...pane('network')}>
                    <div className="flex items-center justify-between">
                      <p className="font-display text-[15px] font-semibold text-ink">Broker Network</p>
                      <span className="chip">
                        <i className="bi bi-sliders h-3 w-3" aria-hidden="true" />
                        Filters
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-2xs">
                      <span className="chip">For sale</span>
                      <span className="chip">Dubai</span>
                      <span className="chip">2+ beds</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {NETWORK.map(([src, price, meta, sel, md]) => (
                        <div
                          key={meta}
                          className={cx(
                            'overflow-hidden rounded-lg border border-line bg-white',
                            md && 'hidden md:block',
                          )}
                        >
                          <img src={src} alt="" className="h-20 w-full object-cover" loading="lazy" />
                          <div className="p-2.5">
                            <p className="text-xs font-semibold text-ink">{price}</p>
                            <p className="truncate text-2xs text-muted">{meta}</p>
                            {sel ? (
                              <span className="mt-2 inline-flex items-center gap-1 text-2xs font-semibold text-ink">
                                <i className="bi bi-bookmark-check-fill h-3 w-3" aria-hidden="true" />
                                Selected
                              </span>
                            ) : (
                              <span className="mt-2 inline-flex items-center gap-1 text-2xs text-muted">
                                <i className="bi bi-bookmark h-3 w-3" aria-hidden="true" />
                                Select
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Selected */}
                  <div {...pane('selected')}>
                    <div className="flex items-center justify-between">
                      <p className="font-display text-[15px] font-semibold text-ink">Selected Properties</p>
                      <span className="text-2xs text-muted">3 of 50 slots used</span>
                    </div>
                    <div className="meter mt-3">
                      <span style={{ width: '6%' }} />
                    </div>
                    <div className="mt-4 space-y-2.5">
                      <SelectedRow
                        src={IMG + 'dubai-marina.webp'}
                        title="Marina Gate Two-Bedroom Residence"
                        by="Listed by Skyline Crest Realty"
                        note="Buyer prefers high floor — confirm service charge."
                      />
                      <SelectedRow
                        src={PIMG + 'prop-creek-towers.webp'}
                        title="Creek Harbour Waterfront One-Bedroom"
                        by="Listed by Harbourview Properties"
                        note="Off-plan option for investor client."
                      />
                      <div className="flex gap-3 rounded-lg border border-line bg-white p-3 opacity-80">
                        <img
                          src={PIMG + 'prop-courtyard-residences.webp'}
                          alt=""
                          className="h-14 w-20 shrink-0 rounded object-cover grayscale"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-ink">Old Town Courtyard Apartment</p>
                            <span className="badge badge-muted">No longer available</span>
                          </div>
                          <p className="text-2xs text-muted">Your notes are kept</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Account */}
                  <div {...pane('account')}>
                    <p className="font-display text-[15px] font-semibold text-ink">Account &amp; Membership</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-line bg-white p-3.5">
                        <p className="text-2xs font-semibold tracking-[.1em] text-muted uppercase">
                          Professional profile
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage text-xs font-semibold text-ink">
                            AR
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-ink">Aisha Rahman</p>
                            <p className="text-2xs text-muted">Licensed Broker · Dubai</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-2xs">
                          <span className="text-muted">RERA credentials</span>
                          <span className="badge badge-warn">Pending review</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-line bg-white p-3.5">
                        <p className="text-2xs font-semibold tracking-[.1em] text-muted uppercase">Membership</p>
                        <p className="mt-3 font-display text-[16px] font-semibold text-ink">
                          Starter <span className="f font-normal text-muted">trial</span>
                        </p>
                        <div className="mt-3 space-y-2 text-2xs">
                          <div className="flex justify-between">
                            <span className="text-muted">Active listings</span>
                            <span>4 / 25</span>
                          </div>
                          <div className="meter">
                            <span style={{ width: '16%' }} />
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted">Selections</span>
                            <span>3 / 50</span>
                          </div>
                          <div className="meter">
                            <span style={{ width: '6%' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-white p-3 text-2xs text-muted">
                      <i className="bi bi-bell h-3.5 w-3.5 text-ink" aria-hidden="true" />
                      Notifications, security, and PDPL privacy controls in one place.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectedRow({ src, title, by, note }) {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-white p-3">
      <img src={src} alt="" className="h-14 w-20 shrink-0 rounded object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold text-ink">{title}</p>
          <span className="badge badge-ok">Available</span>
        </div>
        <p className="text-2xs text-muted">{by}</p>
        <p className="mt-1.5 rounded bg-paper px-2 py-1 text-2xs text-muted">
          <i className="bi bi-sticky mr-1 inline h-3 w-3" aria-hidden="true" />
          {note}
        </p>
      </div>
    </div>
  );
}
