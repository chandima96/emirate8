import { AMENITY_GROUPS } from '@/config/reference';
import { fmtAED, fmtDate } from '@/lib/store';

/** Rows with an empty value are omitted; groups with no rows are omitted. */
function Group({ title, rows }) {
  const r = rows.filter(([, v]) => v !== '' && v != null && v !== false);
  if (!r.length) return null;
  return (
    <div className="dl-group">
      <h3 className="dl-title">{title}</h3>
      <dl>
        {r.map(([k, v]) => (
          <div key={k} className="dl-row">
            <dt>{k}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 05 — grouped property details (definition rows). */
export function Details({ listing: l }) {
  const off = l.completion === 'offplan';
  const o = l.offplan || {};
  const rent = l.purpose === 'rent';
  const amen = (grp) => (l.amenities || []).filter((a) => AMENITY_GROUPS[grp].indexOf(a) > -1).join(', ');

  return (
    <section className="mt-12" aria-labelledby="h-info">
      <h2 id="h-info" className="h3">
        Property details
      </h2>
      <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {(l.publicDetails || []).map((section) => (
          <Group key={section.title} title={section.title} rows={section.rows} />
        ))}
        {l.additionalFeatures?.length > 0 && (
          <Group
            title="Additional features"
            rows={l.additionalFeatures.map((f) => [f.name, f.description || 'Included'])}
          />
        )}
        {l.additionalTerms?.length > 0 && (
          <Group
            title="Additional terms"
            rows={l.additionalTerms.map((term) => [
              term.label,
              [
                term.amount ? 'AED ' + term.amount : '',
                term.frequency,
                term.payer ? 'Paid by ' + term.payer : '',
                term.notes,
              ]
                .filter(Boolean)
                .join(' \u00b7 ') || 'See listing terms',
            ])}
          />
        )}
        <Group
          title="Overview"
          rows={[
            ['Purpose', rent ? 'Rent' : 'Sale'],
            ['Category', l.category === 'land' ? 'Land' : l.category === 'commercial' ? 'Commercial' : 'Residential'],
            ['Property type', l.type],
            ['Development status', l.category === 'land' ? '' : off ? 'Off-plan' : 'Ready'],
            [off ? 'Project' : 'Building', off ? o.project : l.building],
            ['Community', l.area],
            ['Emirate', l.emirate],
            ['View', l.view],
            ['Condition', l.condition],
          ]}
        />
        {off ? (
          <Group
            title="Development"
            rows={[
              ['Developer', o.developer],
              ['Development type', o.devType],
              ['Construction status', o.devStatus],
              ['Launch', o.launch],
              ['Expected handover', o.handover],
              ['Unit availability', o.unitAvailability],
              ['Project registration', o.projectReg],
            ]}
          />
        ) : (
          <Group
            title="Building & unit"
            rows={[
              ['Floor', l.floor !== '' && l.floor != null ? String(l.floor) : l.floorBand || ''],
              ['Completion year', l.completionYear],
              ['Furnishing', l.furnishing],
              ['Balcony', l.amenities.indexOf('Balcony') > -1 ? 'Yes' : ''],
              ['Interior', amen('Interior')],
            ]}
          />
        )}
        <Group
          title="Building facilities"
          rows={[
            ['Facilities', amen('Building')],
            ['Outdoor', amen('Outdoor')],
            ['Wellness', amen('Wellness')],
            ['Security', amen('Security')],
          ]}
        />
        <Group
          title="Parking"
          rows={[
            ['Spaces', l.parking !== '' && l.parking != null ? l.parking : ''],
            ['Parking features', amen('Parking')],
          ]}
        />
        {rent ? (
          <Group
            title="Rental terms"
            rows={[
              ['Annual rent', l.price ? fmtAED(l.price) : ''],
              ['Payments', l.cheques ? `${l.cheques} cheque${+l.cheques === 1 ? '' : 's'}` : ''],
              ['Security deposit', l.deposit ? `${l.deposit}% of annual rent` : ''],
              ['Available from', l.availableFrom],
              ['Terms', l.rentalTerms],
            ]}
          />
        ) : (
          <Group
            title="Costs & availability"
            rows={[
              ['Asking price', l.price ? fmtAED(l.price) : ''],
              ['Price per sqft', l.price && l.size ? fmtAED(l.price / l.size) : ''],
              ['Service charges', l.serviceCharge ? `AED ${l.serviceCharge} per sqft per year (as provided)` : ''],
              ['Occupancy', l.occupancy],
              ['Tenancy', l.tenancyInfo],
              ['Available', l.availableFrom],
            ]}
          />
        )}
        <Group
          title="Ownership & listing"
          rows={[
            ['Ownership', l.ownership],
            ['Advertising permit', l.permit && l.permit.number],
            ['Permit expiry', l.permit && l.permit.expiry ? fmtDate(l.permit.expiry) : ''],
            ['Emirate08 reference', l.ref],
            ['Listed', l.createdAt ? fmtDate(l.createdAt) : ''],
          ]}
        />
        <Group
          title="Community amenities"
          rows={[
            ['Nearby', amen('Community')],
            ['Notes', l.nearbyNote],
          ]}
        />
      </div>
    </section>
  );
}
