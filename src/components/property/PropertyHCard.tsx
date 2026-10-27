'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ContactButtons } from '@/components/broker/ContactButtons';
import { FavButton } from './FavButton';
import { ListingBadges, ListingSpecs } from './ListingBits';
import { fmtNumber, listingUrl } from '@/lib/store';
import { cx } from '@/lib/utils';
import { mediaDisplayURL } from '@/lib/mediaURL';

/** Horizontal card (Bayut-style broker portfolio rows) with in-card photo stepping. */
export function PropertyHCard({ listing: l, preview = false }) {
  const [i, setI] = useState(0);
  const b = l.broker || {};
  const url = preview ? '#' : listingUrl(l);
  const imgs = l.images || [];
  const closed = l.status === 'sold' || l.status === 'rented';
  const A = preview ? 'a' : Link;
  const step = (d) => (e) => {
    e.preventDefault();
    if (imgs.length) setI((v) => (v + d + imgs.length) % imgs.length);
  };
  return (
    <article className={cx('hcard', closed && 'is-closed')}>
      <div className="hcard-media">
        <A href={url} className="block h-full" tabIndex={-1} aria-hidden="true">
          {imgs[i] && <img src={mediaDisplayURL(imgs[i])} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </A>
        <ListingBadges listing={l} />
        <FavButton listing={l} preview={preview} />
        {imgs.length > 1 && (
          <>
            <button
              type="button"
              className="cg-nav left-2"
              onClick={step(-1)}
              aria-label="Previous photo"
              tabIndex={preview ? -1 : undefined}
            >
              <Icon name="chevron-left" className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="cg-nav right-2"
              onClick={step(1)}
              aria-label="Next photo"
              tabIndex={preview ? -1 : undefined}
            >
              <Icon name="chevron-right" className="h-4 w-4" />
            </button>
          </>
        )}
        <span className="photo-count">
          <Icon name="images" className="h-3.5 w-3.5" />
          {i + 1}/{Math.max(1, imgs.length)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">
            {l.price ? `AED ${fmtNumber(l.price)}` : 'Price on request'}
            {!!l.price && l.purpose === 'rent' && (
              <span className="ml-1 text-[13px] font-normal text-muted">Yearly</span>
            )}
          </p>
          <span className="text-2xs font-semibold tracking-[.1em] text-muted uppercase">Ref {l.ref || '—'}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text">
          <span className="font-semibold">{l.type || ''}</span>
          <ListingSpecs listing={l} className="gap-x-3 text-[13px] text-text" />
        </div>
        <h3 className="mt-2 text-[15px] leading-snug font-semibold">
          <A href={url} className="text-ink hover:underline">
            {l.title || 'Untitled listing'}
          </A>
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
          <Icon name="geo-alt" className="h-3.5 w-3.5" />
          {[l.building, l.area, l.emirate].filter(Boolean).join(', ')}
        </p>
        {!!(l.highlights || []).length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {l.highlights.slice(0, 3).map((h) => (
              <span key={h} className="chip font-medium">
                {h}
              </span>
            ))}
          </div>
        )}
        {l.completion === 'offplan' && l.offplan?.handover && (
          <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded bg-sage-soft px-2 py-1 text-xs text-sage-ink">
            <Icon name="calendar-check" className="h-3.5 w-3.5" />
            Handover {l.offplan.handover}
          </p>
        )}
        {closed ? (
          <p className="mt-auto pt-4 text-xs text-muted">
            {l.status === 'sold' ? 'Sold' : 'Rented'} through this broker on Emirate08.
          </p>
        ) : (
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <ContactButtons broker={b} listing={l} preview={preview} />
          </div>
        )}
      </div>
    </article>
  );
}
