import { Icon } from '@/components/ui/Icon';
import { AMENITY_GROUPS } from '@/config/reference';

export const GROUP_TITLES = {
  Interior: 'Interior features',
  Building: 'Building facilities',
  Outdoor: 'Outdoor',
  Wellness: 'Wellness & sport',
  Security: 'Security',
  Parking: 'Parking',
  Community: 'Community amenities',
};

/** 04d — amenities grouped by the reference amenity groups. */
export function Features({ listing: l }) {
  if (!l.amenities?.length) return null;
  const byGroup = {};
  l.amenities.forEach((a) => {
    const g = Object.keys(AMENITY_GROUPS).find((k) => AMENITY_GROUPS[k].indexOf(a) > -1) || 'Other';
    (byGroup[g] = byGroup[g] || []).push(a);
  });
  return (
    <section className="mt-8" aria-labelledby="h-feat">
      <h2 id="h-feat" className="h3">
        Features &amp; amenities
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {Object.keys(byGroup).map((k) => (
          <div key={k}>
            <p className="text-[13px] font-semibold text-ink">{GROUP_TITLES[k] || k}</p>
            <ul className="mt-2 space-y-1.5 text-[14px]">
              {byGroup[k].map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <Icon name="check2" className="h-4 w-4 text-sage-ink" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
