'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useStoreVersion } from '@/hooks/useStore';
import { counts, currentUser, data, fmtPrice, inbox, network, plan, relTime } from '@/lib/store';
import { STATUS } from '@/config/reference';
import { routes } from '@/lib/routes';
import { bi, credText, trialLeft } from './shared';
import { ContactModal, NetworkCard, SelectButton, useSelectToggle } from './network/NetworkBits';
import { PropertyCard } from '@/components/property/PropertyCard';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Kpi({ href, label, icon, value, children }) {
  return (
    <Link href={href} className="kpi group transition-colors hover:border-[#B8C3BE]">
      <div className="flex items-center justify-between text-xs text-muted">
        {label}
        <Icon name={icon} className="h-4 w-4" />
      </div>
      <p className="mt-3 font-display text-[28px] leading-none font-semibold text-ink">{value}</p>
      {children}
    </Link>
  );
}

/** Workspace overview (old dashboard.html + dashboard.js overview part). */
export function Overview() {
  useStoreVersion();
  const toggle = useSelectToggle();
  const [contactId, setContactId] = useState(null);
  const [opportunityTab, setOpportunityTab] = useState('brokers');
  const [developerProperties, setDeveloperProperties] = useState([]);
  const [developerPropertiesLoading, setDeveloperPropertiesLoading] = useState(true);
  const [hello] = useState(greeting);
  const user = currentUser();
  const cs = credText(user);
  const verified = user.credentialStatus === 'verified';
  const pf = user.portfolio || {};
  const [pfLabel, pfCls] =
    pf.isPublic === false
      ? ['Private', 'badge-muted']
      : user.portfolioDraft
        ? ['Unpublished changes', 'badge-warn']
        : ['Live', 'badge-ok'];
  const newEnquiries = inbox().filter((q) => q.status !== 'replied').length;
  const p = plan(user);
  const c = counts(user);
  const d = data();
  const recent = d.listings
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const net = network()
    .filter((n) => n.available)
    .sort((a, b) => a.listed - b.listed)
    .slice(0, 3);

  useEffect(() => {
    let alive = true;
    fetch('/api/role-workspace?developerNetwork=preview', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Could not load developer properties.'))))
      .then((result) => { if (alive) setDeveloperProperties(result.developerProperties || []); })
      .catch(() => { if (alive) setDeveloperProperties([]); })
      .finally(() => { if (alive) setDeveloperPropertiesLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h2 text-[24px] lg:text-[28px]">
            {hello}, {user.name.split(' ')[0]}.
          </h1>
          <p className="mt-1 text-[14px] text-muted">Here’s what’s happening across your brokerage workspace.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/listings/new" className="btn btn-dark">
            <Icon name="plus-lg" />
            Add Property
          </Link>
          <Link href="/network" className="btn btn-outline">
            <Icon name="diagram-3" />
            Browse Network
          </Link>
        </div>
      </div>

      {/* Status */}
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="card flex items-start gap-3.5 p-4">
          <span
            className={
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
              (verified ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')
            }
          >
            <Icon name={verified ? 'shield-check' : 'shield-exclamation'} className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-ink">Professional Credentials</p>
              <span className={'badge ' + cs[1]}>{cs[0]}</span>
            </div>
            <p className="mt-1 text-xs leading-[1.55] text-muted">
              {verified
                ? 'Your credentials are verified — you can publish listings.'
                : 'You can prepare drafts and browse the network. Publishing unlocks after verification.'}
            </p>
          </div>
          <Link href="/account#credentials" className="btn btn-ghost btn-sm shrink-0">
            View
          </Link>
        </div>
        <div className="card flex items-start gap-3.5 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage-ink">
            <Icon name="gem" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-ink">Plan</p>
              <span className="badge badge-sage">{p.name + (user.trial ? ' Trial' : '')}</span>
            </div>
            <p className="mt-1 text-xs leading-[1.55] text-muted">
              {user.trial
                ? trialLeft(user) + ' days left in your trial · pricing to be confirmed.'
                : 'Your plan is active.'}
            </p>
          </div>
          <Link href="/subscription" className="btn btn-ghost btn-sm shrink-0">
            Manage
          </Link>
        </div>
        <div className="card flex min-w-0 items-start gap-3.5 p-4 md:col-span-2 xl:col-span-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist text-ink">
            <Icon name="person-badge" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-ink">Public portfolio</p>
              <span className={'badge ' + pfCls}>{pfLabel}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted">
              /brokers/{pf.slug || '—'} · {newEnquiries} new enquiries
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Link href="/brokers/me" className="btn btn-ghost btn-sm">
              View
            </Link>
            <Link href="/profile" className="btn btn-ghost btn-sm">
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi href="/listings?status=published" label="Published Listings" icon="buildings" value={c.published}>
          <p className="mt-2 text-2xs text-muted">{p.listings ? 'of ' + p.listings + ' on your plan' : 'Fair use'}</p>
        </Kpi>
        <Kpi href="/listings?status=draft" label="Draft Listings" icon="pencil-square" value={c.draft + c.pending}>
          <p className="mt-2 text-2xs text-muted">Waiting for details or permits</p>
        </Kpi>
        <Kpi href="/network" label="Network Opportunities" icon="diagram-3" value={c.network}>
          <p className="mt-2 text-2xs text-muted">Available sample records</p>
        </Kpi>
        <Kpi href="/selected" label="Selected Properties" icon="bookmark" value={c.selected}>
          <div className="meter mt-3">
            <span style={{ width: Math.min(100, (c.selected / p.selections) * 100) + '%' }} />
          </div>
        </Kpi>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Listings preview */}
        <section className="card overflow-hidden xl:col-span-2" aria-labelledby="lp-title">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 id="lp-title" className="h4 text-[15px]">
              My Listings
            </h2>
            <Link href="/listings" className="arrow-link text-xs">
              View all
              <Icon name="arrow-right" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-[620px]">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th className="text-right">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recent.length ? (
                  recent.map((l) => {
                    const s = STATUS[l.status] || STATUS.draft;
                    return (
                      <tr key={l.id}>
                        <td>
                          <Link href={routes.listing(l.id)} className="flex items-center gap-3">
                            {l.images && l.images[0] ? (
                              <img
                                src={l.images[0]}
                                alt=""
                                className="h-10 w-14 shrink-0 rounded object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="h-10 w-14 shrink-0 rounded bg-mist" />
                            )}
                            <span className="min-w-0">
                              <span className="block max-w-[240px] truncate font-semibold text-ink hover:underline">
                                {l.title || 'Untitled draft'}
                              </span>
                              <span className="block text-2xs text-muted">
                                {(l.area || '—') + ' · ' + (l.type || '') + (l.sample ? ' · Sample' : '')}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="font-semibold whitespace-nowrap text-ink">{l.price ? fmtPrice(l) : '—'}</td>
                        <td>
                          <span className={'badge ' + s.cls}>{s.label}</span>
                        </td>
                        <td className="text-right text-xs whitespace-nowrap text-muted">{relTime(l.updatedAt)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[13px] text-muted">
                      No listings yet.{' '}
                      <Link href="/listings/new" className="link">
                        Create your first listing
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        {/* Activity */}
        <section className="card xl:col-span-1" aria-labelledby="ra-title">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 id="ra-title" className="h4 text-[15px]">
              Recent Activity
            </h2>
            <span className="badge badge-muted">This browser</span>
          </div>
          <ol className="divide-y divide-line">
            {d.activity.length ? (
              d.activity.slice(0, 6).map((a, i) => (
                <li key={a.at + i} className="flex gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist">
                    <Icon name={bi(a.icon || 'dot')} className="h-3.5 w-3.5 text-ink" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] leading-[1.45] text-text">{a.text}</p>
                    <p className="mt-0.5 text-2xs text-muted">{relTime(a.at)}</p>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-4 py-6 text-center text-[13px] text-muted">No activity yet.</li>
            )}
          </ol>
        </section>
      </div>

      {/* Network preview */}
      <section className="mt-6" aria-labelledby="np-title">
        <div className="flex items-end justify-between">
          <div>
            <h2 id="np-title" className="h4 text-[15px]">Property Opportunities</h2>
            <p className="mt-0.5 text-xs text-muted">Browse published properties from brokers and developers.</p>
          </div>
          <Link href={opportunityTab === 'brokers' ? '/network' : '/developer-network'} className="arrow-link text-xs">
            Browse all
            <Icon name="arrow-right" />
          </Link>
        </div>
        <div className="mt-3 flex gap-2" role="tablist" aria-label="Property source">
          {[
            { key: 'brokers', label: 'Brokers', total: net.length },
            { key: 'developers', label: 'Developers', total: developerProperties.length },
          ].map(({ key, label, total }) => (
            <button key={key} type="button" role="tab" aria-selected={opportunityTab === key}
              className={`btn btn-sm ${opportunityTab === key ? 'btn-dark' : 'btn-outline'}`}
              onClick={() => setOpportunityTab(key)}>
              {label} <span className="ml-1 opacity-75">{total}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="tabpanel">
          {opportunityTab === 'brokers' && net.map((n) => (
            <NetworkCard key={n.id} n={n} onToggle={toggle} onContact={setContactId} />
          ))}
          {opportunityTab === 'developers' && developerProperties.slice(0, 3).map((property) => (
            <div className="card overflow-hidden" key={property.id}>
              <PropertyCard listing={property} tag={property.developerName} className="rounded-none border-0 shadow-none" />
              <div className="border-t border-line p-3"><SelectButton n={property} small onToggle={toggle} /></div>
            </div>
          ))}
          {opportunityTab === 'brokers' && net.length === 0 && <p className="col-span-full py-6 text-center text-sm text-muted">No published broker properties are available right now.</p>}
          {opportunityTab === 'developers' && developerPropertiesLoading && <p className="col-span-full py-6 text-center text-sm text-muted">Loading developer properties…</p>}
          {opportunityTab === 'developers' && !developerPropertiesLoading && developerProperties.length === 0 && <p className="col-span-full py-6 text-center text-sm text-muted">No published developer properties are available right now.</p>}
        </div>
      </section>
      <ContactModal id={contactId} onClose={() => setContactId(null)} />
    </div>
  );
}
