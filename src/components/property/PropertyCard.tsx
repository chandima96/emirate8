'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/broker/Avatar';
import { FavButton } from './FavButton';
import { ListingBadges, ListingSpecs, Price } from './ListingBits';
import { brokerUrl, listingUrl, photoOf } from '@/lib/store';
import { cx } from '@/lib/utils';

/** Vertical property card — search results, carousels, similar properties and the editor card preview. */
export function PropertyCard({ listing: l, preview = false, agent = true, tag = undefined, className = undefined }) {
  const b = l.broker || {};
  const url = preview ? '#' : listingUrl(l);
  const n = (l.images || []).length;
  const photo = photoOf(l);
  const cover = (l.photos || []).find((p) => p.src === l.featured) || {};
  const A = preview ? 'a' : Link;
  return (
    <article className={cx('pcard relative', className)}>
      <A href={url} className="relative block aspect-[4/3] overflow-hidden bg-mist" tabIndex={-1} aria-hidden="true">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="pimg h-full w-full object-cover"
            loading="lazy"
            style={{ objectPosition: (cover.focalX ?? 50) + '% ' + (cover.focalY ?? 50) + '%' }}
          />
        ) : (
          <span className="flex h-full items-center justify-center text-muted">
            <Icon name="image" className="h-6 w-6" />
          </span>
        )}
        {['render', 'construction'].includes(cover.imgType) && (
          <span className="absolute top-2 left-2 rounded bg-white/95 px-2 py-1 text-2xs text-ink">
            {cover.imgType === 'construction' ? 'Construction update' : 'Artist impression'}
          </span>
        )}
        {n > 1 && (
          <span className="photo-count">
            <Icon name="images" className="h-3.5 w-3.5" />
            {n}
          </span>
        )}
      </A>
      <ListingBadges listing={l} extra={tag} />
      <FavButton listing={l} preview={preview} />
      <div className="flex flex-1 flex-col p-4">
        <Price listing={l} className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink" />
        <h3 className="mt-1 text-[14px] leading-snug font-semibold text-ink">
          <A href={url} className="line-clamp-1 hover:underline">
            {l.title || 'Untitled listing'}
          </A>
        </h3>
        <ListingSpecs listing={l} className="mt-2 text-[13px] text-text" />
        <p className="mt-2 flex items-center gap-1.5 truncate text-[13px] text-muted">
          <Icon name="geo-alt" className="h-3.5 w-3.5" />
          {[l.building, l.area].filter(Boolean).join(', ') || 'Location not set'}
        </p>
        {agent && b.name && (
          <div className="mt-auto flex items-center gap-2 border-t border-mist pt-3">
            <span className="mt-3 flex items-center gap-2">
              <Avatar person={b} size={26} />
              <span className="text-xs text-muted">
                Listed by{' '}
                <A className="font-semibold text-ink hover:underline" href={preview ? '#' : brokerUrl(b)}>
                  {b.name}
                </A>
              </span>
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
