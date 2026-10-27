import { Icon } from '@/components/ui/Icon';
import { fmtNumber } from '@/lib/store';
import { cx } from '@/lib/utils';

export function bedsLabel(l) {
  if (l.beds === 0 || l.beds === '0') return 'Studio';
  return l.beds ? `${l.beds} bed${+l.beds === 1 ? '' : 's'}` : '';
}

/** For sale / For rent / Sold, Ready / Off-plan, Featured — overlaid top-left on card media. */
export function ListingBadges({ listing: l, featured = true, extra = undefined }) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
      <span className="ptag-dark">
        {l.status === 'sold'
          ? 'Sold'
          : l.status === 'rented'
            ? 'Rented'
            : l.purpose === 'rent'
              ? 'For rent'
              : 'For sale'}
      </span>
      <span className="ptag-light">{l.completion === 'offplan' ? 'Off-plan' : 'Ready'}</span>
      {l.display?.portfolioFeatured && featured && (
        <span className="ptag-sage">
          <Icon name="star-fill" className="h-3 w-3" />
          Featured
        </span>
      )}
      {extra && <span className="ptag-light">{extra}</span>}
    </div>
  );
}

export function ListingSpecs({ listing: l, className = 'text-[13px] text-text' }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {l.category !== 'commercial' && l.beds !== '' && l.beds != null && (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="door-closed" className="h-4 w-4 text-muted" />
          {bedsLabel(l)}
        </span>
      )}
      {!!l.baths && (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="droplet" className="h-4 w-4 text-muted" />
          {l.baths} bath{+l.baths === 1 ? '' : 's'}
        </span>
      )}
      {!!l.size && (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="bounding-box" className="h-4 w-4 text-muted" />
          {fmtNumber(l.size)} sqft
        </span>
      )}
    </div>
  );
}

export function Price({ listing: l, period = '/year', className }) {
  return (
    <p className={className}>
      {l.price ? `AED ${fmtNumber(l.price)}` : 'Price on request'}
      {!!l.price && l.purpose === 'rent' && <span className="ml-1 text-[13px] font-normal text-muted">{period}</span>}
    </p>
  );
}
