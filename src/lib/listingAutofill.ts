import { listingSchema as S } from '@/components/listings/editor/designer-schema';

// Only descriptive listing answers can be suggested. Publication, ownership,
// broker assignment, private identifiers, permits and declarations remain user-controlled.
export const LISTING_AI_FIELDS = [
  // Classification
  'purpose', 'category', 'ptype', 'devStatus', 'stage', 'txn',
  // Location
  'emirate', 'communityId', 'subcommunity', 'buildingName', 'tower', 'developer', 'street', 'mapLocation',
  // Size & layout
  'bedrooms', 'bathrooms', 'parking', 'parkingType', 'extraRooms', 'layoutCode',
  'unitArea', 'builtUpArea', 'plotArea', 'balconyArea', 'floorBand', 'storeys', 'amenities',
  // Condition, views & specification
  'furnishing', 'condition', 'occupancy', 'completionYear', 'handoverQ', 'handoverY', 'handoverDate', 'plannedSpec',
  'tenure', 'leaseTerm', 'views', 'viewExtent', 'kitchenLayout', 'appliances', 'pets', 'cooling', 'officeFit', 'fitOut', 'otherInfo',
  // Price & terms
  'askingPrice', 'negotiable', 'unitPrice', 'annualRent', 'serviceCharge', 'serviceBasis', 'possession',
  'rentalIncome', 'tenancyExpiry', 'bookingBasis', 'booking', 'postHandover', 'incentives',
  'availability', 'availableFrom', 'minTenancy', 'cheques', 'depositBasis', 'deposit', 'utilities',
  // Marketing
  'title', 'description', 'locHighlights',
];

const LOCATION_LABELS = { emirate: 'Emirate', communityId: 'Area / Community', buildingName: 'Building / Project', mapLocation: 'Google Maps location', milestones: 'Payment plan' };
const AREA_KEYS = ['unitArea', 'builtUpArea', 'plotArea', 'balconyArea'];
const MILESTONE_TRIGGERS = ['booking', 'date', 'construction', 'handover', 'post'];
const NUMBER = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

export function isSupportedGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return ((host === 'google.com' || host === 'www.google.com' || host === 'maps.google.com') && (url.pathname === '/maps' || url.pathname.startsWith('/maps/'))) ||
      (host === 'maps.app.goo.gl' && url.pathname.length > 1) || (host === 'goo.gl' && url.pathname.startsWith('/maps/'));
  } catch { return false; }
}
export function listingAiLabel(key: string) {
  const base = key.replace(/(Max|Multi)$/, '');
  const label = S.FIELDS[base]?.label;
  const name = LOCATION_LABELS[base] || (typeof label === 'string' ? label : base);
  return key.endsWith('Max') ? `${name} (upper value)` : key.endsWith('Multi') ? `${name} (all options)` : name;
}

export function listingAiFieldSpec() {
  const d = { ...S.defaultData(), purpose: 'sale', category: 'residential', ptype: 'apartment', devStatus: 'ready' };
  const c = S.ctxOf(d);
  const fields: any[] = LISTING_AI_FIELDS.map((key) => {
    if (key === 'amenities') return { key, label: 'Features and amenities', kind: 'array', options: Object.values(S.AMENITY).map((item: any) => ({ value: item.id, label: item.l })) };
    const f = S.FIELDS[key];
    const options = key === 'ptype' ? Object.values(S.PTYPES).flat().map((item: any) => item[0])
      : f ? S.optsOf(f, c, d).map((option) => option.v) : [];
    const kind = f?.kind === 'amt' ? `number (amount; AED or % according to ${f.basisKey})` : f?.kind || 'text';
    return {
      key, label: listingAiLabel(key), kind,
      ...(options.length ? { options } : {}),
      ...(f?.kind === 'multi' ? { returns: 'array of option values' } : {}),
      ...(f?.multiOk ? { multiple: 'Return an array of option values only when the source offers several for this listing (e.g. 1, 2 and 3 bedroom units).' } : {}),
      ...(f?.rangeOk ? { range: f.kind === 'area' ? 'Add "rawMax" when the source gives a range for this listing.' : `Add "${key}Max" with the upper value when the source gives a range for this listing.` } : {}),
    };
  });
  fields.push({
    key: 'milestones', label: 'Payment plan', kind: 'array',
    returns: 'array of {"name":"On booking","mode":"pct" or "aed","value":"20","trigger":"booking|date|construction|handover|post","when":"YYYY-MM-DD for date, otherwise short text such as 50% construction or 24 months after handover"}',
  });
  return fields;
}

function choiceValues(f: any, c: any, d: any, value: unknown) {
  const allowed = S.optsOf(f, c, d).map((option) => String(option.v));
  const list = (Array.isArray(value) ? value : [value]).map((item) => String(item ?? '').trim());
  return allowed.filter((option) => list.includes(option));
}

function cleanArea(value: any) {
  if (!value || typeof value !== 'object' || !['sqft', 'sqm'].includes(value.unit)) return null;
  const raw = String(value.raw ?? '').trim();
  if (!NUMBER.test(raw) || !(Number(raw.replace(/,/g, '')) > 0)) return null;
  const out: Record<string, string> = { raw: raw.replace(/,/g, ''), unit: value.unit };
  const max = String(value.rawMax ?? '').trim();
  if (NUMBER.test(max) && Number(max.replace(/,/g, '')) > Number(out.raw)) out.rawMax = max.replace(/,/g, '');
  return out;
}

function cleanMilestones(value: unknown) {
  if (!Array.isArray(value)) return null;
  const rows = value.slice(0, 20).flatMap((row: any, index) => {
    if (!row || typeof row !== 'object') return [];
    const mode = row.mode === 'aed' ? 'aed' : 'pct';
    const amount = String(row.value ?? '').replace(/[%,\s]|AED/gi, '');
    if (!/^\d+(\.\d+)?$/.test(amount) || !(Number(amount) > 0) || (mode === 'pct' && Number(amount) > 100)) return [];
    const trigger = MILESTONE_TRIGGERS.includes(row.trigger) ? row.trigger : 'construction';
    const when = String(row.when ?? '').trim().slice(0, 80);
    return [{
      id: `ai-ms-${index + 1}`,
      name: String(row.name ?? '').trim().slice(0, 80) || `Payment ${index + 1}`,
      mode, value: amount, trigger,
      when: trigger === 'date' ? (S.util.validDate(when) ? when : '') : ['construction', 'post'].includes(trigger) ? when : '',
    }];
  });
  return rows.length ? rows : null;
}

export function cleanListingSuggestions(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, any>;
  const out: Record<string, any> = {};
  for (const key of LISTING_AI_FIELDS) {
    const value = source[key];
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) continue;
    const f = S.FIELDS[key];
    if (key === 'amenities') {
      if (Array.isArray(value)) {
        const ids = [...new Set(value.filter((id): id is string => typeof id === 'string' && Object.prototype.hasOwnProperty.call(S.AMENITY, id)))];
        if (ids.length) out[key] = ids;
      }
      continue;
    }
    if (key === 'mapLocation') {
      if (typeof value === 'string' && value.length <= 2048 && isSupportedGoogleMapsUrl(value)) out[key] = value;
      continue;
    }
    if (AREA_KEYS.includes(key)) {
      const area = cleanArea(value);
      if (area) out[key] = area;
      continue;
    }
    // Several answers (multi fields, or choice fields where the source lists options) are checked later.
    if (Array.isArray(value)) {
      if (f?.kind === 'multi' || f?.multiOk) out[key] = value.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 20);
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (f?.kind === 'multi') { out[key] = [String(value).trim()]; continue; }
    const text = String(value).trim().slice(0, f?.max || (key === 'description' ? 5000 : 180));
    if (!text) continue;
    const kind = f?.kind === 'amt' ? 'money' : f?.kind;
    if (['int', 'dec', 'money', 'pct'].includes(kind) && (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text)))) continue;
    if (kind === 'date' && !S.util.validDate(text)) continue;
    if (kind === 'year' && !/^\d{4}$/.test(text)) continue;
    out[key] = text;
    if (f?.rangeOk && kind === 'money') {
      const max = String(source[key + 'Max'] ?? '').trim();
      if (/^\d+(\.\d+)?$/.test(max) && Number(max) > Number(text)) out[key + 'Max'] = max;
    }
  }
  const milestones = cleanMilestones(source.milestones);
  if (milestones) out.milestones = milestones;

  // Validate options against the proposed classification, not the old draft.
  const d = { ...S.defaultData(), ...out };
  for (const key of Object.keys(out)) if (Array.isArray(d[key]) && S.FIELDS[key]?.multiOk) d[key] = d[key][0];
  const c = S.ctxOf(d);
  for (const key of Object.keys(out)) {
    const f = S.FIELDS[key];
    if (!f || !['seg', 'select', 'multi'].includes(f.kind)) continue;
    const values = choiceValues(f, c, d, out[key]);
    if (f.kind === 'multi') {
      if (values.length) out[key] = values; else delete out[key];
      continue;
    }
    const several = Array.isArray(out[key]) && f.multiOk ? values.filter((v) => !S.MULTI_EXCLUDED.includes(v)) : [];
    if (several.length > 1) {
      out[key] = several[0];
      out[key + 'Multi'] = several;
    } else if (Array.isArray(out[key])) {
      if (values[0]) out[key] = values[0]; else delete out[key];
    } else if (!values.length) delete out[key];
  }
  return out;
}
