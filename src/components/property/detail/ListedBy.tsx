'use client';

import Link from 'next/link';
import { Avatar, VerifiedBadge } from '@/components/broker/Avatar';
import { ContactButtons, contactBroker } from '@/components/broker/ContactButtons';
import { brokerStats, brokerUrl } from '@/lib/store';
import { PLink, isClosed } from './shared';

/** 08 — the listing broker with credentials, contact actions and View Broker Portfolio. */
export function ListedBy({ listing: l, preview }) {
  const raw = l.broker || {};
  const b = contactBroker(raw, l);
  const st = preview ? { active: '' } : brokerStats(b);
  // A property has up to five brokers and no "primary" one; the contact above is shown once, the rest below.
  const others = (l.brokerProfiles || []).filter(
    (p) => p && String(p.id) !== String(raw.id) && String(p.slug || '') !== String(raw.slug || '-'),
  );

  return (
    <section className="mt-12" aria-labelledby="h-by">
      <h2 id="h-by" className="h3">
        Listed by
      </h2>
      <div className="mt-4 grid gap-5 rounded-lg border border-line bg-white p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
        {preview ? (
          <Avatar person={b} size={104} />
        ) : (
          <Link href={brokerUrl(b)} aria-label={`${b.name} portfolio`}>
            <Avatar person={b} size={104} />
          </Link>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-[19px] font-semibold text-ink">
              {preview ? (
                b.name
              ) : (
                <Link className="hover:underline" href={brokerUrl(b)}>
                  {b.name}
                </Link>
              )}
            </p>
            <VerifiedBadge broker={b} />
          </div>
          <p className="text-[13px] text-text">
            {b.title || ''} · {b.agencyName || 'Independent broker'}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
            {b.experience && (
              <div className="flex gap-2">
                <dt className="text-muted">Experience</dt>
                <dd className="font-semibold text-ink">{b.experience} years</dd>
              </div>
            )}
            {st.active !== '' && (
              <div className="flex gap-2">
                <dt className="text-muted">Active listings</dt>
                <dd className="font-semibold text-ink">{st.active}</dd>
              </div>
            )}
            {!!(b.areas || []).length && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-muted">Areas</dt>
                <dd className="text-ink">{b.areas.join(', ')}</dd>
              </div>
            )}
            {b.brn && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-muted">Registration</dt>
                <dd className="text-ink">
                  {b.brn}
                  {b.brnVerified ? ' (verified)' : ' (not yet verified)'}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col">
          {!isClosed(l) && <ContactButtons broker={raw} listing={l} preview={preview} size="" />}
          <PLink preview={preview} href={brokerUrl(b)} className="btn btn-dark">
            View broker portfolio
          </PLink>
        </div>
      </div>
      {others.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[13px] font-semibold text-ink">
            {raw.id || raw.name ? 'Also representing this property' : 'Brokers for this property'}
          </h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => {
              const ob = contactBroker(p, l);
              return (
                <li key={String(p.id || p.slug)} className="flex items-center gap-3 rounded-lg border border-line bg-white p-3">
                  <Avatar person={ob} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {preview ? ob.name : <Link className="hover:underline" href={brokerUrl(ob)}>{ob.name}</Link>}
                    </p>
                    <p className="truncate text-xs text-muted">{ob.agencyName || 'Independent broker'}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
