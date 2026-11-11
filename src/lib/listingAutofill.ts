import { listingSchema as S } from '@/components/listings/editor/designer-schema';

// Only descriptive listing answers can be suggested. Publication, ownership,
// broker assignment, private identifiers and declarations remain user-controlled.
export const LISTING_AI_FIELDS = [
  'purpose', 'category', 'ptype', 'devStatus', 'stage', 'txn',
  'emirate', 'communityId', 'buildingName', 'developer', 'street',
  'bedrooms', 'bathrooms', 'parking', 'unitArea', 'builtUpArea', 'plotArea',
  'furnishing', 'condition', 'occupancy', 'completionYear', 'handoverQ', 'handoverY', 'tenure',
  'askingPrice', 'unitPrice', 'annualRent', 'serviceCharge', 'serviceBasis',
  'title', 'description', 'locHighlights',
];

const LOCATION_LABELS = { emirate: 'Emirate', communityId: 'Area / Community', buildingName: 'Building / Project' };
export function listingAiLabel(key: string) {
  const label = S.FIELDS[key]?.label;
  return LOCATION_LABELS[key] || (typeof label === 'string' ? label : key);
}

export function listingAiFieldSpec() {
  const d = { ...S.defaultData(), purpose: 'sale', category: 'residential', ptype: 'apartment', devStatus: 'ready' };
  const c = S.ctxOf(d);
  return LISTING_AI_FIELDS.map((key) => {
    const f = S.FIELDS[key];
    const options = key === 'ptype' ? Object.values(S.PTYPES).flat().map((item: any) => item[0])
      : f ? S.optsOf(f, c, d).map((option) => option.v) : [];
    return { key, label: listingAiLabel(key), kind: f?.kind || 'text', ...(options.length ? { options } : {}) };
  });
}

export function cleanListingSuggestions(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, any> = {};
  for (const key of LISTING_AI_FIELDS) {
    const value = input[key];
    if (value == null || value === '') continue;
    const f = S.FIELDS[key];
    if (['unitArea', 'builtUpArea', 'plotArea'].includes(key)) {
      if (typeof value === 'object' && ['sqft', 'sqm'].includes(value.unit) && /^\d+(\.\d+)?$/.test(String(value.raw)) && Number(value.raw) > 0)
        out[key] = { raw: String(value.raw), unit: value.unit };
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim().slice(0, f?.max || (key === 'description' ? 5000 : 180));
    if (!text) continue;
    if (['int', 'dec', 'money', 'pct'].includes(f?.kind) && (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text)))) continue;
    out[key] = text;
  }
  // Validate options against the proposed classification, not the old draft.
  const d = { ...S.defaultData(), ...out };
  const c = S.ctxOf(d);
  for (const key of Object.keys(out)) {
    const f = S.FIELDS[key];
    if (f && ['seg', 'select'].includes(f.kind) && !S.optsOf(f, c, d).some((option) => String(option.v) === out[key])) delete out[key];
  }
  return out;
}
