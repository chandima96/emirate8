import { listingSchema as S } from '@/components/listings/editor/designer-schema';

// Only descriptive listing answers can be suggested. Publication, ownership,
// broker assignment, private identifiers, permits and declarations remain user-controlled.
export const LISTING_AI_FIELDS = [
  // Classification
  'purpose', 'category', 'ptype', 'devStatus', 'stage', 'txn',
  // Location
  'emirate', 'communityId', 'subcommunity', 'buildingName', 'tower', 'developer', 'masterDeveloper', 'street', 'mapLocation',
  // Size & layout
  'bedrooms', 'bathrooms', 'parking', 'extraRooms', 'layoutCode', 'totalFloors',
  'unitArea', 'builtUpArea', 'plotArea', 'balconyArea', 'floorBand', 'storeys', 'amenities',
  // Condition, views & specification
  'furnishing', 'condition', 'occupancy', 'completionYear', 'handoverQ', 'handoverY', 'handoverDate', 'plannedSpec',
  'tenure', 'leaseTerm', 'views', 'kitchenLayout', 'pets', 'cooling', 'officeFit', 'fitOut', 'otherInfo',
  // Price & terms
  'askingPrice', 'negotiable', 'unitPrice', 'annualRent', 'serviceCharge', 'serviceBasis', 'possession', 'possessionDate',
  'rentalIncome', 'tenancyExpiry', 'bookingBasis', 'booking', 'incentives',
  'availability', 'availableFrom', 'minTenancy', 'cheques', 'depositBasis', 'deposit', 'utilities',
  // Marketing
  'title', 'description', 'locHighlights',
];

// Private identifiers and agreement terms. These are suggested only from documents or text the user
// supplies (title deed, permit, Form A, SOA), never from a public web page, and always shown for review.
export const LISTING_AI_PRIVATE_FIELDS = [
  'unitNo', 'floorNo', 'permitNo', 'permitExpiry', 'authType', 'authExpiry', 'exclusive',
  'commBasis', 'commission', 'commPayer',
  'originalPrice', 'paidToDev', 'outstanding', 'payToSeller', 'nextInstDate', 'nextInstAmt', 'transferElig', 'nocStatus',
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
  const text = typeof label === 'function' ? S.labelOf(S.FIELDS[base], null, { emirate: 'Dubai' }) : label;
  const name = LOCATION_LABELS[base] || (typeof text === 'string' ? text : base);
  return key.endsWith('Max') ? `${name} (upper value)` : key.endsWith('Multi') ? `${name} (all options)` : name;
}

/* Instructions for each field, sent next to the field in the prompt. Rules that apply to every field
 * (scope, untrusted sources, conflicts, evidence) stay in the prompt itself. */
export const LISTING_AI_HINTS: Record<string, string> = {
  // Classification
  purpose: 'sale when the property is offered for sale, rent when it is offered for rent or lease.',
  category: 'From the property type: homes are residential; offices, shops, showrooms, warehouses and similar are commercial; plots are land.',
  ptype: 'Type of the advertised unit. For a project offering several types (e.g. apartments and townhouses) return an array.',
  devStatus: 'ready when the property is explicitly completed, handed over or ready to move in; offplan when explicitly off-plan or under construction. The portal\'s structured completion fact wins over any tag or headline: Bayut "Completion status: Ready", a Property Finder "Project information" badge "Completed", or a delivery / handover date before today all mean ready, even if a tag says "Offplan". A project overview that calls itself off-plan stays offplan even if construction has not started. For-sale status alone does not establish this. Omit for land.',
  stage: 'Off-plan only: construction stage as stated. Omit for a ready property.',
  txn: 'Sale only. resale when the page says resale or secondary market (off-plan units can be resales; Property Finder "Offplan: Re-Sale", a Bayut "Resale" line); initial when sold directly by the developer or at a project launch (Property Finder "Offplan: Primary", a Bayut "Initial Sale" line). A developer project page with starting prices, a payment plan and a future handover is initial unless it explicitly says resale. Words in a description ("great resale value") do not count.',
  // Location
  emirate: 'The emirate named in the source location, e.g. the first breadcrumb level. Dubai is not a default: omit when the source does not establish the emirate.',
  communityId: 'The main community name, e.g. Palm Jumeirah, Dubai Hills Estate, Downtown Dubai, Al Raha Beach. Breadcrumbs run emirate > community > subcommunity > building: "Dubai > Palm Jumeirah > Golden Mile > Golden Mile 4" gives Palm Jumeirah. Never combine levels.',
  subcommunity: 'The cluster or project inside the community, e.g. Golden Mile, Park Lane, Opera District, Al Seef. Never guess a missing level.',
  buildingName: 'The specific building or tower, e.g. Golden Mile 4, Park Lane Building 2b, Lamar Residences.',
  tower: 'A tower or block within the building or project, only when stated separately from the building name.',
  developer: 'The developer of this building or project ("Developed by", "Developer").',
  masterDeveloper: 'The master developer of the community, only when stated.',
  street: 'Street name or address line, only when stated.',
  mapLocation: 'Only an exact Google Maps URL explicitly present in the source for this property. Never create or infer one.',
  // Size & layout
  bedrooms: 'Bedrooms of the advertised unit. "Studio, 1 & 2 bedroom apartments" gives ["studio","1","2"].',
  bathrooms: 'Bathrooms of the advertised unit, only when stated.',
  parking: 'Number of parking spaces for the unit, only when a number is stated. "Covered parking" without a number is an amenity, not this field.',
  extraRooms: 'Maid\'s room, study and driver\'s room explicitly mentioned for this unit.',
  layoutCode: 'Unit layout or type code as printed, e.g. "Type 2B" or "A1".',
  totalFloors: 'Total floors of the building, only when stated.',
  unitArea: 'Apartment, office or shop unit size. For an apartment a single stated size ("4,442 sqft") is unitArea. Never substitute builtUpArea, plotArea or balconyArea.',
  builtUpArea: 'Only an area explicitly labelled BUA or built-up area, typical for villas and townhouses: "BUA 1,647 sqft" gives 1647. Never substitute unitArea or plotArea.',
  plotArea: 'Plot or land area only: "plot 1,828 sqft" gives 1828.',
  balconyArea: 'Balcony or terrace area only.',
  floorBand: 'Only when explicitly stated: "Mid Floor" gives mid, "High floor" gives high.',
  storeys: 'Number of storeys of a villa or townhouse, only when stated.',
  amenities: 'Features explicitly stated for this property, as amenity IDs; never infer shared amenities. Parking features ("Covered Parking" gives covered_parking, basement parking gives basement_parking), storage and laundry rooms (storage, laundry), kitchen appliances (appliances), "Built in Wardrobes" (wardrobes), "Balcony" (balcony), "Shared Pool" (sh_pool), "Shared Gym" (sh_gym), "Children\'s Play Area" (play) and "Security" (sec) are amenities. "See all amenities (13)" means the list shown is partial: never invent the hidden ones.',
  // Condition, views & specification
  furnishing: 'As stated. "Furnished or unfurnished" gives ["furnished","unfurnished"].',
  condition: '"Upgraded: Yes" gives renovated; brand_new only for a new, never-occupied unit stated as such.',
  occupancy: 'Ready property only. vacant only when currently vacant (a promise of vacant on transfer is not current vacancy), owner for owner occupied, tenanted for currently rented.',
  completionYear: 'Ready property: the year it was completed or delivered ("Delivery Date: Q3 2023" gives 2023).',
  handoverQ: 'Off-plan only: the handover quarter, "Q4 2028" gives 4.',
  handoverY: 'Off-plan only: the handover year, "Q4 2028" gives 2028.',
  handoverDate: 'Off-plan only: an exact handover date published for the project, YYYY-MM-DD.',
  plannedSpec: 'Off-plan only: the planned finishing and specification as described.',
  tenure: 'freehold or leasehold, only when stated.',
  leaseTerm: 'Leasehold only: the lease term as stated, e.g. "99 years".',
  views: 'Views explicitly stated: "View of Landmark" gives ["landmark"], sea view gives ["sea"]; "View of Water" gives ["sea"] in a beach or coastal community and ["canal"] on a canal or creek.',
  kitchenLayout: 'Only when the kitchen is described as open, closed or semi-open.',
  pets: 'Only when the source states the pet policy.',
  cooling: '"District cooling" gives district; "Central A/C" or central AC gives central; split units gives split.',
  officeFit: 'Offices only: shell-and-core, fitted or furnished as stated.',
  fitOut: 'Retail and industrial units only: shell-and-core or fitted as stated.',
  otherInfo: 'Remaining factual details about this property that fit no other field, in plain text.',
  // Price & terms
  askingPrice: 'Sale price for a ready property or a resale (including off-plan resales): the advertised price, e.g. the large "AED 25,387,028" at the top of a Bayut or Property Finder listing. Always return it when the page shows one.',
  negotiable: 'Only when the source says the price is negotiable or fixed.',
  unitPrice: 'Sale price for an initial developer sale (devStatus offplan and txn initial): the advertised or starting price, even on a portal.',
  annualRent: 'Yearly rent. Convert a monthly rent only if the page also states the yearly figure.',
  serviceCharge: 'Service charge amount. With serviceBasis per_sqft when stated per sq ft, per_year when a yearly total.',
  serviceBasis: 'per_sqft when the service charge is stated per sq ft, per_year for a yearly total.',
  possession: 'Sale only. "Vacant on transfer" gives on_transfer, "available now" gives now, "subject to tenancy" gives subject_tenancy. expected only with an explicit future "Available from" date. Do not infer possession from occupancy alone.',
  possessionDate: 'Only with possession expected: the "Available from" date, YYYY-MM-DD.',
  rentalIncome: 'Tenanted sale only: the current yearly rent the tenant pays.',
  tenancyExpiry: 'Tenanted property only: the end date of the current tenancy, YYYY-MM-DD.',
  bookingBasis: 'Off-plan sale only, with booking: pct when the booking or down payment is a percentage, aed when an amount.',
  booking: 'Off-plan sale only: the booking or down payment of the payment plan. A "Down payment" in a project card for a completed building, or in a mortgage calculator, is not a booking amount.',
  incentives: 'Developer or seller incentives stated, e.g. DLD fee waiver or service-charge holiday.',
  availability: 'Rent only: "available now" gives now, "Available from" a date gives from.',
  availableFrom: 'Rent only, with availability from: the date, YYYY-MM-DD.',
  minTenancy: 'Rent only: minimum tenancy as stated.',
  cheques: 'Rent only: the cheque options offered, e.g. "1-4 cheques" gives ["1","2","3","4"].',
  depositBasis: 'Rent only, with deposit: pct when the deposit is a percentage of the rent, aed when an amount.',
  deposit: 'Rent only: the security deposit.',
  utilities: 'Rent only: utilities included in the rent.',
  milestones: 'Only when the listing states a payment plan, milestones in order. "20% on booking, 50% during construction, 30% on handover" gives [{"name":"On booking","mode":"pct","value":"20","trigger":"booking","when":""},{"name":"During construction","mode":"pct","value":"50","trigger":"construction","when":"During construction"},{"name":"On handover","mode":"pct","value":"30","trigger":"handover","when":""}]. "60/40" means 60% before and 40% on handover. Post-handover instalments use trigger post. when is YYYY-MM-DD for trigger date, otherwise short text or "".',
  // Marketing
  title: 'The listing headline in plain text.',
  description: 'The full property description, keeping every factual detail, with phone numbers, emails, URLs, agent names, permit and reference numbers removed.',
  locHighlights: 'A summary of nearby places and travel times mentioned for this property.',
  // Private (uploaded documents only)
  unitNo: 'Unit number from a title deed, permit or SPA.',
  floorNo: 'Floor number from a title deed, permit or SPA.',
  permitNo: 'Advertising permit number (Trakheesi / Madhmoun) from a permit document.',
  permitExpiry: 'Advertising permit expiry date, YYYY-MM-DD.',
  authType: 'From a seller–broker agreement (Dubai Form A): owner_agreement.',
  authExpiry: 'End date of the seller–broker agreement, YYYY-MM-DD.',
  exclusive: 'From the seller–broker agreement: exclusive or non_exclusive.',
  commBasis: 'From the agreement: pct when commission is a percentage, aed when an amount.',
  commission: 'The agreed commission from the agreement.',
  commPayer: 'Who pays the commission according to the agreement.',
  originalPrice: 'From a developer statement of account or Oqood: the original purchase price.',
  paidToDev: 'From a developer statement of account: the amount paid to the developer so far.',
  outstanding: 'From a developer statement of account: the outstanding balance.',
  payToSeller: 'Amount the buyer pays the seller, only when stated in the documents.',
  nextInstDate: 'From a developer statement of account: the next instalment date, YYYY-MM-DD.',
  nextInstAmt: 'From a developer statement of account: the next instalment amount.',
  transferElig: 'Transfer eligibility as stated in the documents.',
  nocStatus: 'Developer NOC status as stated in the documents.',
};

const RETURNS: Record<string, string> = {
  int: 'whole number as a string, e.g. "12"',
  dec: 'number as a string, e.g. "4.5"',
  money: 'AED amount as a plain numeric string without currency or separators: "AED 2.46M" is "2460000"',
  pct: 'percentage as a plain numeric string, e.g. "10"',
  date: 'date YYYY-MM-DD',
  year: 'year YYYY',
  area: 'object {"raw":"1200","rawMax":"","unit":"sqft"}; unit is sqft or sqm',
  text: 'plain text',
  textarea: 'plain text',
};

/* Option lists can depend on the listing (commission payer differs for rent and sale, property types per
 * category). The spec lists every option any listing can have; the cleaner then checks each answer
 * against the classification the AI suggested. */
let contextSamples: any[] | null = null;
function allContexts() {
  if (contextSamples) return contextSamples;
  contextSamples = [];
  for (const purpose of ['sale', 'rent']) for (const category of Object.keys(S.PTYPES)) for (const [ptype] of S.PTYPES[category])
    for (const devStatus of ['ready', 'offplan']) for (const txn of ['initial', 'resale']) {
      const d = { ...S.defaultData(), purpose, category, ptype, devStatus, txn };
      contextSamples.push({ d, c: S.ctxOf(d) });
    }
  return contextSamples;
}
function allOptions(f: any) {
  const out = new Map<string, string>();
  for (const { c, d } of allContexts()) {
    let options: any[] = [];
    try { options = S.optsOf(f, c, d); } catch { /* option list not valid for this context */ }
    for (const option of options) if (!out.has(String(option.v))) out.set(String(option.v), String(option.l ?? option.v));
  }
  for (const excluded of S.MULTI_EXCLUDED) out.delete(excluded);
  return Object.fromEntries(out);
}

export type ListingAiField = { key: string; label: string; returns: string; options?: Record<string, string>; hint?: string; multiple?: string; range?: string };

export function listingAiFieldSpec(includePrivate = false): ListingAiField[] {
  const keys = includePrivate ? [...LISTING_AI_FIELDS, ...LISTING_AI_PRIVATE_FIELDS] : LISTING_AI_FIELDS;
  const fields: ListingAiField[] = keys.map((key) => {
    const hint = LISTING_AI_HINTS[key];
    if (key === 'amenities') return { key, label: 'Features and amenities', returns: 'array of amenity IDs', options: Object.fromEntries(Object.values(S.AMENITY).map((item: any) => [item.id, item.l])), hint };
    if (key === 'emirate') return { key, label: listingAiLabel(key), returns: 'emirate name', options: Object.fromEntries(Object.keys(S.EMIRATE_BOUNDS).map((name) => [name, name])), hint };
    if (key === 'ptype') return { key, label: listingAiLabel(key), returns: 'option value, or an array of option values', options: Object.fromEntries(Object.values(S.PTYPES).flat().map((item: any) => [item[0], item[1]])), hint };
    const f = S.FIELDS[key];
    const options = f?.opts ? allOptions(f) : {};
    const hasOptions = Object.keys(options).length > 0;
    const returns = f?.kind === 'multi' ? 'array of option values'
      : hasOptions ? (f?.multiOk ? 'option value, or an array of option values' : 'option value')
      : f?.kind === 'amt' ? `plain numeric string; AED amount or percentage according to ${f.basisKey}`
      : RETURNS[f?.kind] || 'plain text';
    return {
      key, label: listingAiLabel(key), returns,
      ...(hasOptions ? { options } : {}),
      ...(hint ? { hint } : {}),
      ...(f?.multiOk ? { multiple: 'Return an array only when the source offers several for this listing (e.g. 1, 2 and 3 bedroom units).' } : {}),
      ...(f?.rangeOk ? { range: f.kind === 'area' ? 'Set "rawMax" when the source gives a range for this listing.' : `Return "${key}Max" as a separate field with the upper value when the source gives a range for this listing.` } : {}),
    };
  });
  fields.push({
    key: 'milestones', label: 'Payment plan', hint: LISTING_AI_HINTS.milestones,
    returns: 'array of {"name","mode":"pct"|"aed","value":"20","trigger":"booking"|"date"|"construction"|"handover"|"post","when"}',
  });
  return fields;
}

/** Every key the model may answer: the spec's fields plus the upper value of money ranges. */
export function listingAiKeys(includePrivate = false) {
  const keys = listingAiFieldSpec(includePrivate).map((field) => field.key);
  const ranges = keys.filter((key) => S.FIELDS[key]?.rangeOk && S.FIELDS[key]?.kind === 'money').map((key) => key + 'Max');
  return [...keys, ...ranges];
}

/* JSON schema for structured outputs. Each answer is a {key, value, evidence} row rather than an object
 * with ~90 optional properties, which keeps the schema small and makes evidence part of every answer. */
const VALUE_SCHEMA = {
  anyOf: [
    { type: 'string' },
    { type: 'array', items: { type: 'string' } },
    {
      type: 'object', additionalProperties: false, required: ['raw', 'rawMax', 'unit'],
      properties: { raw: { type: 'string' }, rawMax: { type: 'string' }, unit: { type: 'string', enum: ['sqft', 'sqm'] } },
    },
    {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'mode', 'value', 'trigger', 'when'],
        properties: {
          name: { type: 'string' }, mode: { type: 'string', enum: ['pct', 'aed'] }, value: { type: 'string' },
          trigger: { type: 'string', enum: MILESTONE_TRIGGERS }, when: { type: 'string' },
        },
      },
    },
  ],
};

export function listingAiOutputSchema(includePrivate: boolean, labels: string[]) {
  const key = { type: 'string', enum: listingAiKeys(includePrivate) };
  return {
    type: 'object', additionalProperties: false, required: ['sources'],
    properties: {
      sources: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['label', 'fields', 'conflicts'],
          properties: {
            label: { type: 'string', enum: labels },
            fields: {
              type: 'array',
              items: {
                type: 'object', additionalProperties: false, required: ['key', 'value', 'evidence'],
                properties: { key, value: VALUE_SCHEMA, evidence: { type: 'string' } },
              },
            },
            conflicts: {
              type: 'array',
              items: {
                type: 'object', additionalProperties: false, required: ['key', 'values'],
                properties: { key, values: { type: 'array', items: VALUE_SCHEMA } },
              },
            },
          },
        },
      },
    },
  };
}

/** Turns the model's {key, value, evidence} rows into the suggestions object the cleaner expects. */
export function rowsToSuggestions(rows: unknown) {
  const suggestions: Record<string, any> = {};
  const evidence: Record<string, string> = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row.key !== 'string' || Object.prototype.hasOwnProperty.call(suggestions, row.key)) continue;
    suggestions[row.key] = row.value;
    evidence[row.key] = typeof row.evidence === 'string' ? row.evidence : '';
  }
  return { suggestions, evidence };
}

/** Model output for numbers is not always bare digits: "25,387,028", "AED 25,387,028", "2.46M", "10%".
 * Normalise to a plain numeric string, or '' when it isn't a single number. */
export function aiNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? String(value) : '';
  if (typeof value !== 'string') return '';
  const m = /^(?:AED|Dhs?\.?|د\.إ)?\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(k|m|mn|million|bn|b|billion)?\s*(?:AED|%|\/\s*(?:year|yr|annum))?$/i.exec(value.trim());
  if (!m) return '';
  const n = Number(m[1].replace(/,/g, '') + (m[2] || ''));
  const scale = { k: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 }[(m[3] || '').toLowerCase()] || 1;
  const out = Math.round(n * scale * 100) / 100;
  return Number.isFinite(out) ? String(out) : '';
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

export function cleanListingSuggestions(input: unknown, opts: { allowPrivate?: boolean } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, any>;
  const out: Record<string, any> = {};
  const keys = opts.allowPrivate ? [...LISTING_AI_FIELDS, ...LISTING_AI_PRIVATE_FIELDS] : LISTING_AI_FIELDS;
  for (const key of keys) {
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
    const kind = f?.kind === 'amt' ? 'money' : f?.kind;
    const numeric = ['int', 'dec', 'money', 'pct'].includes(kind);
    const text = numeric ? aiNumber(value) : String(value).trim().slice(0, f?.max || (key === 'description' ? 5000 : 180));
    if (!text) continue;
    if (kind === 'date' && !S.util.validDate(text)) continue;
    if (kind === 'year' && !/^\d{4}$/.test(text)) continue;
    out[key] = text;
    if (f?.rangeOk && kind === 'money') {
      const max = aiNumber(source[key + 'Max']);
      if (max && Number(max) > Number(text)) out[key + 'Max'] = max;
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
    // "More than 10" and "Unknown" are not facts from a source; the field is left for the user instead.
    const values = choiceValues(f, c, d, out[key]).filter((v) => !S.MULTI_EXCLUDED.includes(v));
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
  alignPriceKey(out);
  return out;
}

/** The model often returns a portal's headline price as askingPrice even when the listing is an
 * off-plan initial sale, whose form only shows unitPrice (and vice versa). Moves the price (and its
 * range end) to the field the suggested classification actually uses. Mutates and returns `out`. */
export function alignPriceKey(out: Record<string, any>) {
  const c = S.ctxOf({ ...S.defaultData(), ...out });
  if (!c.sale) return out;
  const want = c.offInit ? 'unitPrice' : 'askingPrice';
  const other = want === 'unitPrice' ? 'askingPrice' : 'unitPrice';
  if (out[other] && !out[want]) {
    out[want] = out[other];
    delete out[other];
    if (out[other + 'Max']) { out[want + 'Max'] = out[other + 'Max']; delete out[other + 'Max']; }
  }
  return out;
}
