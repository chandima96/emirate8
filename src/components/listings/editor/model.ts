/* Listing editor model: blank record, conditional-field tokens, payment-plan templates and per-step validation
 * (ported from js/listing-editor.js). */
import { TYPES } from '@/config/reference';
import { im } from '@/config/images';
import { fileToDataURL, uid } from '@/lib/utils';

export const STEPS = 8;
export const MAX_PHOTOS = 30;
export const NAMES = [
  'Classification',
  'Location',
  'Property details',
  'Price & terms',
  'Marketing',
  'Photos & media',
  'Permit & display',
  'Review & publish',
];
/** Computed/display-only keys that are never stored with the record. */
export const DERIVED = ['broker', 'images', 'available', 'listed', 'own', 'permitStatus'];
export const STAGES = [
  ['booking', 'Booking'],
  ['construction', 'Construction'],
  ['handover', 'Handover'],
  ['post', 'Post-handover'],
];
export const PLAN_COLORS = ['bg-ink', 'bg-ink-2', 'bg-sage-ink', 'bg-sage', 'bg-line'];
export const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/** Sample photo library (licensed photography, see Terms › Credits). */
export const LIBRARY = [
  'hero-dubai',
  'dubai-marina',
  'downtown-dubai',
  'business-bay',
  'dubai-hills',
  'palm-jumeirah',
  'downtown-boulevard',
  'dubai-skyline',
  'marina-night',
  'jlt-night',
  'palm-aerial',
  'villa-pool',
  'prop-villa',
  'prop-townhouse',
  'prop-waterfront-apartment',
  'prop-creek-towers',
  'int-living-3',
  'int-kitchen-1',
  'int-kitchen-3',
  'int-kitchen-4',
  'int-dining-1',
  'int-bedroom-1',
  'int-bedroom-2',
  'int-bedroom-3',
  'prop-marina-interior',
  'prop-apartment-interior',
  'prop-penthouse',
  'prop-office',
  'prop-meeting-room',
].map(im);

export function blankListing() {
  return {
    completion: '',
    purpose: '',
    category: 'residential',
    type: '',
    emirate: 'Dubai',
    area: '',
    building: '',
    unit: '',
    title: '',
    summary: '',
    description: '',
    beds: '',
    baths: '',
    size: '',
    plot: '',
    parking: '',
    furnishing: '',
    condition: '',
    completionYear: '',
    floor: '',
    totalFloors: '',
    view: '',
    availableFrom: '',
    price: '',
    cheques: '',
    deposit: '',
    rentalTerms: '',
    occupancy: '',
    serviceCharge: '',
    tenancyInfo: '',
    ownership: 'Freehold',
    offplan: {
      project: '',
      developer: '',
      devType: 'Residential tower',
      devStatus: 'Under construction',
      launch: '',
      handover: '',
      projectReg: '',
      unitAvailability: 'Selected units available',
      projectDesc: '',
      booking: '',
      developerHighlights: '',
      plan: [],
    },
    highlights: [],
    amenities: [],
    amenityCategories: {},
    keyPoints: '',
    nearbyNote: '',
    photos: [],
    featured: '',
    media: { video: '', tour: '', floorplans: [], brochure: null, masterplan: '' },
    permit: { number: '', expiry: '', document: null },
    brokerRef: '',
    display: { visible: true, portfolioFeatured: false, contact: 'any' },
    authorised: false,
    status: 'draft',
  };
}

/** Fills missing nested objects on a loaded record and strips derived keys. */
export function prepare(l) {
  DERIVED.forEach((k) => delete l[k]);
  l.offplan = l.offplan || { plan: [] };
  l.offplan.plan = l.offplan.plan || [];
  l.media = l.media || {};
  l.media.floorplans = l.media.floorplans || [];
  l.display = l.display || { visible: true, portfolioFeatured: false, contact: 'any' };
  l.permit = { number: '', expiry: '', ...(l.permit || {}) };
  l.photos = l.photos || [];
  l.highlights = l.highlights || [];
  l.amenities = l.amenities || [];
  l.amenityCategories = l.amenityCategories || {};
  if (l.primaryBroker == null) l.primaryBroker = '';
  if (l.ownerDirect !== undefined) l.ownerDirect = l.ownerDirect === true;
  if (l.claimable !== undefined) l.claimable = l.claimable === true;
  l.category = l.category || 'residential';
  if (!l.editor && TYPES[l.category]?.indexOf(l.type) < 0) l.type = '';
  // Preserve saved communities, including names outside the suggested catalogue.
  return l;
}

export function getIn(o, path) {
  return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
}

/** Immutable nested set: copies only the objects along the path. */
export function setIn(o, path, v) {
  const [k, ...rest] = path.split('.');
  return { ...o, [k]: rest.length ? setIn((o && o[k]) || {}, rest.join('.'), v) : v };
}

/** Tokens that decide which conditional fields are shown (old data-when). */
export function tokens(L) {
  const t: Record<string, number> = {};
  t[L.completion || 'none'] = 1;
  t[L.purpose || 'nopurpose'] = 1;
  t[L.category === 'commercial' ? 'com' : 'res'] = 1;
  if (/Villa|Townhouse|Plot|Warehouse/.test(L.type)) t.plot = 1;
  if (L.purpose === 'sale' && L.completion === 'ready') t['sale-ready'] = 1;
  return t;
}

export function planTotal(plan) {
  return Math.round(plan.reduce((s, m) => s + (+m.pct || 0), 0) * 100) / 100;
}

export function template(k) {
  const id = () => uid('m');
  if (k === '50/50')
    return [
      { id: id(), label: 'Booking deposit', stage: 'booking', pct: 10, due: 'On reservation' },
      {
        id: id(),
        label: 'During construction',
        stage: 'construction',
        pct: 40,
        due: 'Instalments during construction',
      },
      { id: id(), label: 'On handover', stage: 'handover', pct: 50, due: 'At completion' },
    ];
  if (k === 'post')
    return [
      { id: id(), label: 'Booking deposit', stage: 'booking', pct: 10, due: 'On reservation' },
      {
        id: id(),
        label: 'During construction',
        stage: 'construction',
        pct: 40,
        due: 'Instalments during construction',
      },
      { id: id(), label: 'On handover', stage: 'handover', pct: 20, due: 'At completion' },
      { id: id(), label: 'Post-handover instalments', stage: 'post', pct: 30, due: 'Over 24 months after handover' },
    ];
  return [
    { id: id(), label: 'Booking deposit', stage: 'booking', pct: 10, due: 'On reservation' },
    { id: id(), label: 'During construction', stage: 'construction', pct: 50, due: 'Instalments during construction' },
    { id: id(), label: 'On handover', stage: 'handover', pct: 40, due: 'At completion' },
  ];
}

/* Required fields per step, in on-screen order: [step, path, element id, message, data-when token, options]. */
const REQUIRED: [number, string, string, string, string?, { min?: number; num?: boolean }?][] = [
  [1, 'type', 'f-type', 'Choose a property type.'],
  [2, 'emirate', 'f-emirate', 'Choose an emirate.'],
  [2, 'area', 'f-area', 'Choose the community.'],
  [2, 'offplan.project', 'f-project', 'Add the project name.', 'offplan'],
  [2, 'offplan.developer', 'f-developer', 'Add the developer’s name.', 'offplan'],
  [2, 'offplan.handover', 'f-handover', 'Add the expected handover date.', 'offplan'],
  [3, 'title', 'f-title', 'Add a title of at least 8 characters.', null, { min: 8 }],
  [3, 'description', 'f-desc', 'Add a description of at least 40 characters.', null, { min: 40 }],
  [3, 'beds', 'f-beds', 'Select the number of bedrooms.', 'res'],
  [3, 'baths', 'f-baths', 'Select the number of bathrooms.', null, { num: true }],
  [3, 'size', 'f-size', 'Enter the built-up area in sqft.', null, { num: true }],
  [3, 'furnishing', 'f-furn', 'Select the furnishing.', 'ready'],
  [4, 'price', 'f-price', 'Enter the price.', null, { num: true }],
  [4, 'cheques', 'f-cheques', 'Choose the number of cheques.', 'rent'],
];
/** Every error key a step can produce (cleared before that step is re-checked). */
export const STEP_KEYS = {
  1: ['completion', 'purpose', 'type'],
  2: ['emirate', 'area', 'offplan.project', 'offplan.developer', 'offplan.handover'],
  3: ['title', 'description', 'beds', 'baths', 'size', 'furnishing', 'completionYear'],
  4: ['price', 'cheques', 'plan'],
  5: [],
  6: ['media.video', 'media.tour'],
  7: ['permit.number', 'permit.expiry', 'permit.document', 'authorised', 'primaryBroker'],
  8: [],
};
const URL_RX = /^https:\/\/[^\s.]+\.[^\s]+$/;

/** Validates one step. Returns [{ key, id, msg }] in on-screen order (empty when the step is valid). */
export function validateStep(n, L) {
  const t = tokens(L);
  const bad = [];
  const add = (key, id, msg) => {
    const i = bad.findIndex((b) => b.key === key);
    if (i > -1) bad[i] = { key, id, msg };
    else bad.push({ key, id, msg });
  };
  if (n === 1) {
    if (!L.completion) add('completion', 'err-completion', 'Choose ready or off-plan.');
    if (!L.purpose) add('purpose', 'err-purpose', 'Choose sale or rent.');
  }
  REQUIRED.forEach(([step, path, id, msg, when, o = {}]) => {
    if (step !== n || (when && !t[when])) return;
    const v = getIn(L, path);
    const empty = v === '' || v == null || (o.num && !(+v > 0)) || (o.min && String(v).trim().length < o.min);
    if (empty) add(path, id, msg);
  });
  if (n === 6) {
    [
      ['media.video', 'f-video'],
      ['media.tour', 'f-tour'],
    ].forEach(([path, id]) => {
      const v = getIn(L, path);
      if (v && !URL_RX.test(String(v).trim())) add(path, id, 'Use a full https:// link.');
    });
  }
  if (n === 3 && L.size && L.size < 100) add('size', 'f-size', 'Built-up area looks too small — enter it in sqft.');
  if (
    n === 3 &&
    t.ready &&
    L.completionYear &&
    (L.completionYear < 1960 || L.completionYear > new Date().getFullYear())
  )
    add('completionYear', 'f-year', 'Use a past or current year.');
  if (n === 4 && L.price && L.price < 1000) add('price', 'f-price', 'Enter the full amount in AED.');
  if (n === 4 && L.completion === 'offplan') {
    const pl = L.offplan.plan;
    const tot = planTotal(pl);
    if (!pl.length) add('plan', 'err-plan', 'Add at least one payment milestone.');
    else if (tot !== 100)
      add('plan', 'err-plan', 'The payment plan totals ' + tot + '%. Adjust the milestones to total 100%.');
    else if (pl.some((m) => !String(m.label || '').trim())) add('plan', 'err-plan', 'Give every milestone a name.');
  }
  if (n === 7 && !String(L.permit.number || '').trim()) add('permit.number', 'f-permit', 'Enter the advertising permit number.');
  if (n === 7 && !L.permit.document) add('permit.document', 'f-permit-doc', 'Upload the advertising permit document.');
  if (n === 7 && L.permit.expiry && new Date(L.permit.expiry) <= new Date())
    add('permit.expiry', 'f-permit-exp', 'This permit has expired.');
  return bad;
}

/** Validates and downscales an uploaded image; rejects with a user-facing message. */
export function readImage(file, max, quality) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    return Promise.reject(file.name + ' isn’t a JPG, PNG or WebP image.');
  if (file.size > 15 * 1048576) return Promise.reject(file.name + ' is larger than 15 MB.');
  return fileToDataURL(file, max, quality).then((src) => {
    if (!src) throw file.name + ' couldn’t be read.';
    return src;
  });
}

/** "AED 2.5 million" / "AED 95,000 per year" hint under the price field. */
export function priceWords(price, purpose, fmtNumber) {
  const p = +price;
  if (!p) return '';
  return (
    (p >= 1e6 ? 'AED ' + (p / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' million' : 'AED ' + fmtNumber(p)) +
    (purpose === 'rent' ? ' per year' : '')
  );
}
