import { Icon } from '@/components/ui/Icon';
import { bedsLabel } from '@/components/property/ListingBits';
import { fmtNumber } from '@/lib/store';

/** 03 — key facts grid. Facts without a value are left out. */
export function Characteristics({ listing: l }) {
  const off = l.completion === 'offplan';
  const o = l.offplan || {};
  const facts = [
    ['house-door', 'Property type', l.type],
    l.category !== 'commercial' ? ['door-closed', 'Bedrooms', bedsLabel(l) || '—'] : null,
    ['droplet', 'Bathrooms', l.baths || '—'],
    ['bounding-box', 'Built-up area', l.size ? fmtNumber(l.size) + ' sqft' : '—'],
    l.plot ? ['bounding-box-circles', 'Plot area', fmtNumber(l.plot) + ' sqft'] : null,
    off ? null : ['lamp', 'Furnishing', l.furnishing],
    l.parking !== '' && l.parking != null
      ? ['car-front', 'Parking', `${l.parking} space${+l.parking === 1 ? '' : 's'}`]
      : null,
    off
      ? ['calendar-check', 'Expected handover', o.handover || '—']
      : ['calendar-check', 'Completion year', l.completionYear],
    off ? ['buildings', 'Developer', o.developer] : ['calendar-event', 'Availability', l.availableFrom],
    ['key', 'Ownership', l.ownership],
  ].filter((f) => f && f[2] !== '' && f[2] != null);

  return (
    <section className="mt-8" aria-labelledby="h-char">
      <h2 id="h-char" className="h3">
        Characteristics
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 sm:grid-cols-3 lg:grid-cols-5">
        {facts.map(([icon, label, value]) => (
          <div key={label} className="flex items-start gap-2.5">
            <Icon name={icon} className="mt-0.5 h-5 w-5 text-ink" />
            <div className="min-w-0">
              <p className="text-2xs tracking-[.08em] text-muted uppercase">{label}</p>
              <p className="text-[14px] font-semibold text-ink">{String(value)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
