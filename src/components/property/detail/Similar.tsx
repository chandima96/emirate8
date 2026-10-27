'use client';

import { PropertyCard } from '@/components/property/PropertyCard';
import { publicListings } from '@/lib/store';

/** Scores public listings by area, purpose, type, completion, bedrooms and price proximity. */
export function similarTo(l, n = 4) {
  return publicListings()
    .filter((x) => x.id !== l.id)
    .map((x) => {
      let s = 0;
      if (x.area === l.area) s += 4;
      if (x.purpose === l.purpose) s += 3;
      if (x.type === l.type) s += 2;
      if (x.completion === l.completion) s += 1;
      if (x.beds != null && l.beds != null && Math.abs(Number(x.beds) - Number(l.beds)) <= 1) s += 1;
      if (l.price && x.price) s += Math.max(0, 2 - Math.abs(Math.log(Number(x.price) / Number(l.price))) * 2);
      return { x, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((r) => r.x);
}

/** 10 — similar properties (omitted in preview, hidden when there are none). */
export function Similar({ listing: l }) {
  const list = similarTo(l, 4);
  if (!list.length) return null;
  return (
    <section className="mt-12" aria-labelledby="h-sim">
      <h2 id="h-sim" className="h3">
        Similar properties
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((x) => (
          <PropertyCard key={x.id} listing={x} />
        ))}
      </div>
    </section>
  );
}
