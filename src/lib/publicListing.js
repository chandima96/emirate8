import { listingSchema as S } from '../components/listings/editor/designer-schema.js';

/** Remove workspace answers and private identifiers at every public/preview boundary. */
export function publicListing(source) {
  if (!source) return source;
  const l = { ...source },
    d = source.editor?.d || source.appData?.editor?.d;
  delete l.editor;
  delete l.unit;
  delete l.brokerRef;
  delete l.ownerMemberId;
  if (l.permit) l.permit = { number: l.permit.number, expiry: l.permit.expiry };
  if (l.appData) l.appData = publicListing(l.appData);
  if (!d) return l;
  if (d.locPrecision === 'approximate') {
    delete l.building;
    delete l.community;
    delete l.address;
    delete l.coordinates;
    if (l.offplan) l.offplan = { ...l.offplan, project: '' };
  }
  if (d.floorDisplay !== 'exact') {
    delete l.floor;
    if (d.floorDisplay !== 'band') delete l.floorBand;
  }
  if (d.floorDisplay === 'band') l.floorBand = S.FIELDS.floorBand.opts.find((o) => o.v === d.floorBand)?.l || '';
  if (d.overrideContact)
    l.contactOverride = {
      phone: d.cPhone || '',
      whatsapp: d.cWhats || '',
      email: d.cEmail || '',
      channels: d.cChannels || [],
      hours: d.cHours || '',
      verified: false,
    };
  const c = S.ctxOf(d);
  // Explicit public sections. Operational, financial source and contact override answers stay in the workspace.
  l.publicDetails = S.activeSections(2, c, d)
    .filter((section) => !['amen', 'custom', 'needClass'].includes(section.kind))
    .map((section) => ({
      title: section.title,
      rows: (section.fields || [])
        .filter((key) => {
          const f = S.FIELDS[key];
          return (
            !f.priv &&
            (!f.when || f.when(c, d)) &&
            !S.util.isBlank(d[key]) &&
            !['areaUnit', 'floorBand', 'bedroomsCustom', 'bathroomsCustom', 'parkingCustom'].includes(key)
          );
        })
        .map((key) => {
          const f = S.FIELDS[key],
            v = d[key],
            opts = S.optsOf(f, c, d);
          const display = (value) => opts.find((o) => o.v === value)?.l || String(value);
          const value =
            f.kind === 'area'
              ? v.raw + ' ' + (v.unit === 'sqm' ? 'sq m' : 'sq ft')
              : Array.isArray(v)
                ? v.map(display).join(', ')
                : ['bedrooms', 'bathrooms', 'parking'].includes(key) && v === 'custom'
                  ? d[key + 'Custom']
                  : display(v);
          return [S.labelOf(f, c, d), value];
        }),
    }))
    .filter((section) => section.rows.length);
  l.additionalFeatures = (source.editor?.custom || source.appData?.editor?.custom || [])
    .filter((f) => f.name?.trim())
    .map((f) => ({ name: f.name.trim(), description: f.desc || '' }));
  l.additionalTerms = (source.editor?.extraTerms || source.appData?.editor?.extraTerms || [])
    .filter((term) => term.label?.trim())
    .map((term) => ({
      label: term.label,
      amount: term.amount,
      frequency: term.freq,
      payer: term.payer,
      notes: term.notes,
    }));
  return l;
}
