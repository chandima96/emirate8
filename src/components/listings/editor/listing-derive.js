/* Derived answers and account defaults for the listing editor.
 *
 * Every value written here is recorded in `editor.auto[key]`. A derived value is only (re)applied while
 * the field is blank or still holds the value we wrote last time, so anything the user types is kept.
 * `editor.sources[key]` records where an answer came from ('computed', 'defaults', 'catalogue', 'project')
 * for the review step; AI-filled answers are tracked separately in `editor.ai`.
 */
import { listingSchema as S } from './designer-schema.js';
import { COMMUNITIES } from '@/config/reference';

const U = S.util;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Community name → the single emirate it belongs to (names found in more than one emirate are left out). */
const EMIRATE_OF = (() => {
  const seen = new Map();
  for (const [emirate, names] of Object.entries(COMMUNITIES))
    for (const name of names) {
      const key = U.norm(name);
      seen.set(key, seen.has(key) && seen.get(key) !== emirate ? null : emirate);
    }
  return seen;
})();

/** Percentages used when an account has no rental-deposit preference (common Dubai practice). */
const DEPOSIT_PCT = { furnished: '10', partly: '10', unfurnished: '5' };

function floorBandFor(floorNo, totalFloors, ptype) {
  const floor = U.parseIntSafe(floorNo);
  const total = U.parseIntSafe(totalFloors);
  if (floor == null || isNaN(floor)) return '';
  if (floor === 0) return 'ground';
  if (total == null || isNaN(total) || total <= 0 || floor > total) return '';
  if (floor === total && ptype === 'penthouse') return 'penthouse';
  const share = floor / total;
  return share <= 1 / 3 ? 'low' : share <= 2 / 3 ? 'mid' : 'high';
}

function possessionFor(c, d) {
  if (!c.ready || !c.sale) return '';
  return { vacant: 'now', owner: 'on_transfer', tenanted: 'subject_tenancy' }[d.occupancy] || '';
}

/** Service charges under AED 200 are almost always quoted per sq ft; larger figures are annual totals. */
function serviceBasisFor(d) {
  const fils = U.parseMoney(d.serviceCharge);
  if (fils == null || isNaN(fils) || fils <= 0) return '';
  return fils < 20000 ? 'per_sqft' : 'per_year';
}

/** Commission, tax and viewing defaults from the account (`prefs.listing`), copied into the draft. */
function presetValues(presets, c) {
  if (!presets) return {};
  const out = {};
  const side = c.rent ? presets.rent || {} : presets.sale || {};
  // The basis alone would make the commission required, so both are applied together or not at all.
  if (!U.isBlank(side.commission)) {
    out.commBasis = side.commBasis || 'pct';
    out.commission = String(side.commission);
  }
  if (side.commPayer) out.commPayer = side.commPayer;
  if (presets.taxTreatment) out.taxTreatment = presets.taxTreatment;
  if (presets.viewing) out.viewing = presets.viewing;
  if (presets.viewingNotes) out.viewingNotes = presets.viewingNotes;
  if (c.rent && presets.maintenance) out.maintenance = presets.maintenance;
  return out;
}

/** Moves answers from fields that were folded into amenities (parking type, storage/laundry rooms). */
function migrateToAmenities(editor) {
  const d = editor.d;
  const moves = [];
  const parkingMap = { covered: 'covered_parking', basement: 'basement_parking', garage: 'garage', allocated: 'allocated_parking' };
  (Array.isArray(d.parkingType) ? d.parkingType : []).forEach((v) => parkingMap[v] && moves.push(parkingMap[v]));
  const rooms = Array.isArray(d.extraRooms) ? d.extraRooms : [];
  rooms.forEach((v) => (v === 'storage' || v === 'laundry') && moves.push(v));
  if (!moves.length) return editor;
  const amen = { ...(editor.amen || {}) };
  const status = d.devStatus === 'offplan' ? 'planned' : 'existing';
  moves.forEach((id) => {
    if (S.AMENITY[id] && !amen[id]) amen[id] = { selected: true, status, charge: 'included' };
  });
  return {
    ...editor,
    amen,
    d: {
      ...d,
      parkingType: [],
      extraRooms: rooms.filter((v) => v !== 'storage' && v !== 'laundry'),
    },
  };
}

/**
 * Applies derived answers to an editor object. Returns the same object when nothing changes, so callers
 * can cheaply detect a no-op.
 */
export function deriveEditor(editor) {
  if (!editor || !editor.d) return editor;
  let next = migrateToAmenities(editor);
  const d = { ...next.d };
  const auto = { ...(next.auto || {}) };
  const sources = { ...(next.sources || {}) };
  const c = S.ctxOf(d);
  let changed = next !== editor;

  const apply = (key, value, source) => {
    const current = d[key];
    const owned = U.isBlank(current) || (Object.prototype.hasOwnProperty.call(auto, key) && same(current, auto[key]));
    if (!owned) {
      if (auto[key] !== undefined && !same(current, auto[key])) {
        // The user changed it: stop tracking so it is never overwritten.
        delete auto[key];
        if (sources[key] === source) delete sources[key];
        changed = true;
      }
      return;
    }
    if (U.isBlank(value)) {
      if (Object.prototype.hasOwnProperty.call(auto, key)) {
        if (!U.isBlank(current)) d[key] = Array.isArray(current) ? [] : '';
        delete auto[key];
        if (sources[key] === source) delete sources[key];
        changed = true;
      }
      return;
    }
    if (!same(current, value) || !same(auto[key], value)) {
      d[key] = value;
      auto[key] = value;
      sources[key] = source;
      changed = true;
    }
  };

  // The emirate follows the community when the user hasn't chosen one (e.g. Palm Jebel Ali → Dubai).
  apply('emirate', EMIRATE_OF.get(U.norm(d.communityId)) || '', 'computed');
  if (c.unitLike) apply('floorBand', floorBandFor(d.floorNo, d.totalFloors, d.ptype), 'computed');
  apply('possession', possessionFor(c, d), 'computed');
  if (c.sale && !c.land) apply('serviceBasis', serviceBasisFor(d), 'computed');
  if (c.offInit) {
    const rows = next.milestones || [];
    apply('postHandover', rows.length ? (rows.some((r) => r.trigger === 'post') ? 'yes' : 'no') : '', 'computed');
  }
  if (c.rent && !U.isBlank(d.annualRent)) {
    const pct = next.presets?.rent?.depositPct || DEPOSIT_PCT[d.furnishing] || '';
    apply('depositBasis', pct ? 'pct' : '', 'defaults');
    if (d.depositBasis === 'pct') apply('deposit', pct, 'defaults');
  }
  if (c.ready && d.occupancy === 'tenanted') apply('viewing', 'restricted', 'computed');
  const presets = presetValues(next.presets, c);
  Object.keys(presets).forEach((key) => {
    if (key === 'viewing' && c.ready && d.occupancy === 'tenanted') return;
    apply(key, presets[key], 'defaults');
  });

  if (!changed) return editor;
  return { ...next, d, auto, sources };
}

/** Records where a set of answers came from (catalogue, project…). */
export function markSources(editor, keys, source) {
  const sources = { ...(editor.sources || {}) };
  keys.forEach((key) => (sources[key] = source));
  return { ...editor, sources };
}

export const SOURCE_LABEL = {
  computed: 'Calculated',
  defaults: 'Your defaults',
  catalogue: 'Building catalogue',
  project: 'Project',
  ai: 'AI-filled',
};

/** Listing quality score (0–100) with the suggestions that would raise it. */
export function qualityScore(l) {
  const e = l.editor || {};
  const d = e.d || {};
  const photos = (l.photos || []).length;
  const checks = [
    [photos >= 8, 25, photos >= 3 ? 'Add ' + (8 - photos) + ' more photos (8–15 is ideal).' : 'Add at least 8 photos.'],
    [String(d.description || '').length >= 400, 15, 'Write a fuller description (400+ characters).'],
    [(l.highlights || []).length >= 3, 10, 'Add at least 3 key highlights.'],
    [!U.isBlank(d.altTitle) && !U.isBlank(d.altDesc), 10, 'Add the Arabic title and description.'],
    [(l.media?.floorplans || []).length > 0, 10, 'Add a floor plan.'],
    [!!(l.media?.tour || (l.media?.videos || []).length || l.media?.video), 10, 'Add a video or virtual tour.'],
    [(l.amenities || []).length >= 5, 10, 'Select the property’s amenities (5 or more).'],
    [!U.isBlank(d.lat) && !U.isBlank(d.lng), 10, 'Add the map location.'],
  ];
  let score = 0;
  const tips = [];
  checks.forEach(([ok, weight, tip]) => (ok ? (score += weight) : tips.push(tip)));
  return { score, tips };
}
