'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useStoreVersion } from '@/hooks/useStore';
import { fmtNumber, fmtPrice, isSelected, network } from '@/lib/store';
import { cx } from '@/lib/utils';
import { ContactModal, NetworkCard, PermitBadge, SelectButton, agencyOf, useSelectToggle } from './NetworkBits';

function Gallery({ n }) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [out, setOut] = useState(false);
  const timer = useRef(null);
  const count = n.images.length;
  const show = (i) => {
    const next = (i + count) % count;
    setIdx(next);
    setOut(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setShown(next);
      setOut(false);
    }, 180);
  };
  const onKey = useEffectEvent((e) => {
    if (document.querySelector('.modal') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
  useEffect(() => {
    const h = (e) => onKey(e);
    document.addEventListener('keydown', h);
    return () => {
      document.removeEventListener('keydown', h);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-mist">
        <img
          src={n.images[shown]}
          alt={'Illustrative photo for ' + n.title}
          className={cx('img-cover xfade', out && 'is-out')}
        />
        <span className="demo-tag absolute top-3 left-3">Illustrative photo · not the advertised unit</span>
        {count > 1 && (
          <>
            <button
              type="button"
              className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-card"
              aria-label="Previous photo"
              onClick={() => show(idx - 1)}
            >
              <Icon name="chevron-left" className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-card"
              aria-label="Next photo"
              onClick={() => show(idx + 1)}
            >
              <Icon name="chevron-right" className="h-5 w-5" />
            </button>
          </>
        )}
        <span
          className="absolute right-3 bottom-3 rounded-sm bg-ink/80 px-2 py-0.5 text-2xs font-semibold text-white"
          aria-live="polite"
        >
          {idx + 1} / {count}
        </span>
      </div>
      <div className="mt-3 no-scrollbar flex gap-2 overflow-x-auto">
        {n.images.map((src, i) => (
          <button
            key={i}
            type="button"
            className={cx(
              'h-16 w-24 shrink-0 overflow-hidden rounded border-2',
              i === idx ? 'border-ink' : 'border-transparent',
            )}
            aria-label={'Show photo ' + (i + 1)}
            aria-current={i === idx ? 'true' : undefined}
            onClick={() => show(i)}
          >
            <img src={src} alt="" className="img-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </>
  );
}

/** Network property details (old network-detail.html?id= + network.js detail part). */
export function NetworkDetail({ id }) {
  useStoreVersion();
  const toggle = useSelectToggle();
  const [contactId, setContactId] = useState(null);
  const n = network(id);

  if (!n)
    return (
      <div className="mx-auto max-w-[1240px]">
        <div className="card p-10 text-center">
          <p className="h4">This network listing could not be found.</p>
          <Link href="/network" className="btn btn-dark mt-5">
            Back to the network
          </Link>
        </div>
      </div>
    );

  const similar = network()
    .filter((x) => x.id !== n.id && x.available && (x.purpose === n.purpose || x.area === n.area))
    .slice(0, 3);
  const specs = [
    ['Type', n.type],
    ['Bedrooms', n.beds === 0 ? (n.type === 'Office' ? '—' : 'Studio') : n.beds],
    ['Bathrooms', n.baths],
    ['Size', fmtNumber(n.size) + ' sqft'],
  ];

  return (
    <div className="mx-auto max-w-[1240px]" aria-live="polite">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/network" className="hover:text-ink">
          Broker Network
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{n.title}</span>
      </nav>
      {!n.available && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-mist px-4 py-3 text-[13px]">
          <Icon name="slash-circle" className="h-4 w-4" />
          This listing is no longer available. It stays visible here because it’s in your Selected Properties.
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h2 text-[24px] lg:text-[28px]">{n.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
            <Icon name="geo-alt" className="h-4 w-4" />
            {n.area}, {n.emirate} · Listed {n.listed}
            {n.listed === 1 ? ' day' : ' days'} ago
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[24px] font-semibold text-ink">{fmtPrice(n)}</p>
          <p className="text-xs text-muted">{n.purpose === 'rent' ? 'Annual rent' : 'Asking price'}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Gallery key={n.id} n={n} />
          <div className="card mt-6 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
            {specs.map(([k, v]) => (
              <div key={k} className="p-4">
                <p className="text-2xs tracking-[.1em] text-muted uppercase">{k}</p>
                <p className="mt-1 font-display text-[16px] font-semibold text-ink">{v}</p>
              </div>
            ))}
          </div>
          <section className="mt-6">
            <h2 className="h4">About this property</h2>
            <p className="mt-2 text-[14px] leading-[1.7] text-muted">{n.description}</p>
          </section>
          <section className="mt-6">
            <h2 className="h4">Features</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-3">
              {n.amenities.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <Icon name="check-lg" className="h-4 w-4 text-ink" />
                  {a}
                </li>
              ))}
            </ul>
          </section>
          <section className="card mt-6 p-4">
            <h2 className="text-[13px] font-semibold text-ink">Listing facts</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Purpose</dt>
                <dd>{n.purpose === 'rent' ? 'Rent' : 'Sale'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Completion</dt>
                <dd>{n.completion === 'offplan' ? 'Off-plan · ' + n.handover : 'Ready'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Advertising permit</dt>
                <dd>
                  <PermitBadge n={n} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Reference</dt>
                <dd>{n.id.toUpperCase()} (sample)</dd>
              </div>
            </dl>
          </section>
        </div>
        <aside className="lg:col-span-1">
          <div className="card p-5 lg:sticky lg:top-24">
            <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Listing broker</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mist font-semibold text-ink">
                {n.broker.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)}
              </span>
              <div>
                <p className="text-[14px] font-semibold text-ink">{n.broker.name}</p>
                <p className="text-xs text-muted">{agencyOf(n)}</p>
              </div>
            </div>
            <p className="mt-3 text-2xs text-muted">{n.broker.brn} · sample record</p>
            <div className="mt-5 grid gap-2">
              <button type="button" className="btn btn-dark btn-lg w-full" onClick={() => setContactId(n.id)}>
                <Icon name="chat-square-text" />
                Contact Broker
              </button>
              {(n.available || isSelected(n.id)) && <SelectButton n={n} className="btn-lg w-full" onToggle={toggle} />}
            </div>
            <p className="mt-4 border-t border-line pt-4 text-2xs leading-[1.6] text-muted">
              Selecting saves this property to your private collection. It doesn’t notify the listing broker.
            </p>
          </div>
        </aside>
      </div>
      <section className="mt-10">
        <h2 className="h4">Similar network properties</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {similar.map((x) => (
            <NetworkCard key={x.id} n={x} onToggle={toggle} onContact={setContactId} />
          ))}
        </div>
      </section>
      <ContactModal id={contactId} onClose={() => setContactId(null)} />
    </div>
  );
}
