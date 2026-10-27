import { listingSchema as S } from './designer-schema.js';

const U = S.util;
const types = Object.values(S.PTYPES).flat();
const text = (value) => (value == null ? '' : String(value));
const decimal = (value) => {
  const n = U.parseDec(value);
  return Number.isFinite(n) ? n : '';
};
const money = (value) => {
  const n = U.parseMoney(value);
  return Number.isFinite(n) ? n / 100 : '';
};
const optionValue = (key, value) => {
  const f = S.FIELDS[key];
  const opts = typeof f?.opts === 'function' ? [] : f?.opts || [];
  return opts.find((o) => o.v === value || o.l.toLowerCase() === text(value).toLowerCase())?.v || '';
};

/** Upgrade old listings without discarding any of their existing fields. */
export function hydrateEditor(l) {
  if (l.editor?.version === 2) return l;
  const o = l.offplan || {},
    p = l.permit || {};
  const handover = /Q([1-4])\s+(\d{4})/i.exec(o.handover || '');
  const ptype =
    types.find(([key, label]) => label === l.type || key === l.type)?.[0] ||
    (l.type === 'Retail' ? 'shop' : l.type === 'Plot' ? 'residential_plot' : '');
  const d = {
    ...S.defaultData(),
    purpose: l.purpose || '',
    category: /_plot$/.test(ptype) ? 'land' : l.category || 'residential',
    ptype,
    devStatus: l.completion || '',
    stage: optionValue('stage', o.devStatus),
    txn: '',
    extRef: l.brokerRef || '',
    emirate: l.emirate || 'Dubai',
    communityId: l.area || '',
    buildingName: l.building || o.project || '',
    developer: o.developer || '',
    unitNo: l.unit || '',
    floorNo: text(l.floor),
    street: l.address || '',
    lat: text(l.coordinates?.lat),
    lng: text(l.coordinates?.lng),
    bedrooms: l.beds === 0 ? 'studio' : text(l.beds),
    bathrooms: text(l.baths),
    unitArea: l.size ? { raw: text(l.size), unit: 'sqft' } : undefined,
    builtUpArea: l.size ? { raw: text(l.size), unit: 'sqft' } : undefined,
    plotArea: l.plot ? { raw: text(l.plot), unit: 'sqft' } : undefined,
    parking: text(l.parking),
    furnishing: optionValue('furnishing', l.furnishing),
    condition: optionValue('condition', l.condition),
    occupancy: optionValue('occupancy', l.occupancy),
    completionYear: text(l.completionYear),
    handoverQ: handover?.[1] || '',
    handoverY: handover?.[2] || '',
    tenure: optionValue('tenure', l.ownership) || 'freehold',
    askingPrice: text(l.price),
    unitPrice: text(l.price),
    annualRent: text(l.price),
    serviceCharge: text(l.serviceCharge),
    serviceBasis: l.serviceCharge ? 'per_sqft' : '',
    depositBasis: l.deposit ? 'pct' : '',
    deposit: text(l.deposit),
    bookingBasis: 'aed',
    booking: text(o.booking),
    bookingInSchedule: !!o.plan?.length,
    cheques: l.cheques ? [text(l.cheques)] : [],
    title: l.title || '',
    description: l.description || '',
    locHighlights: l.nearbyNote || '',
    tourUrl: l.media?.tour || '',
    permitNo: p.number || '',
    permitExpiry: (p.expiry || '').slice(0, 10),
    decl2: !!l.authorised,
    floorDisplay: 'hidden',
  };
  return {
    ...l,
    editor: {
      version: 2,
      legacyAmenities: (l.amenities || []).filter((name) => !Object.values(S.AMENITY).some((a) => a.l === name)),
      d,
      amen: Object.fromEntries(
        Object.entries(S.AMENITY)
          .filter(([, a]) => (l.amenities || []).includes(a.l))
          .map(([id]) => [id, { selected: true, status: 'existing', charge: 'included' }]),
      ),
      custom: [],
      extraTerms: [],
      cheqAmts: {},
      milestones: (o.plan || []).map((m, i) => ({
        id: m.id || 'old-' + i,
        name: m.label,
        mode: 'pct',
        value: text(m.pct),
        trigger:
          m.stage === 'booking'
            ? 'booking'
            : m.stage === 'handover'
              ? 'handover'
              : m.stage === 'post'
                ? 'post'
                : 'construction',
        when: m.due || '',
      })),
    },
  };
}

export function editorState(l) {
  const e = hydrateEditor(l).editor;
  return {
    ...e,
    highlights: (l.highlights || []).map((text) => ({ text })),
    photos: (l.photos || []).map((p, i) => ({ ...p, id: p.src, imgType: p.imgType || 'actual' })),
    coverId: l.featured,
    videos: [],
    plans: (l.media?.floorplans || []).map((p) => ({ ...p, name: p.name || p.caption || 'Floor plan' })),
  };
}

/** Project active answers into the existing CMS/public listing shape; hidden answers stay in the draft. */
export function projectListing(l) {
  const st = editorState(l),
    d = st.d,
    c = S.ctxOf(d);
  const active = new Set(S.activeFieldKeys(c, d));
  const val = (key) => (active.has(key) ? d[key] : '');
  const areaKey = S.basisAreaKey(c);
  const area = U.areaIn(d[areaKey], 'sqft');
  const priceKey = c.rent ? 'annualRent' : c.offInit ? 'unitPrice' : 'askingPrice';
  const label = (key) => S.optsOf(S.FIELDS[key], c, d).find((o) => o.v === val(key))?.l || '';
  const plan = (c.offInit ? st.milestones || [] : []).map((m) => ({
    id: m.id,
    label: m.name,
    stage:
      m.trigger === 'post'
        ? 'post'
        : m.trigger === 'booking'
          ? 'booking'
          : m.trigger === 'handover'
            ? 'handover'
            : 'construction',
    pct: m.mode === 'pct' ? decimal(m.value) : money(d.unitPrice) > 0 ? (money(m.value) / money(d.unitPrice)) * 100 : 0,
    due: m.when || m.trigger,
  }));
  if (c.offInit && !d.bookingInSchedule && !U.isBlank(d.booking))
    plan.unshift({
      id: 'booking',
      label: 'Booking',
      stage: 'booking',
      pct:
        d.bookingBasis === 'pct'
          ? decimal(d.booking)
          : money(d.unitPrice) > 0
            ? (money(d.booking) / money(d.unitPrice)) * 100
            : 0,
      due: 'On reservation',
    });
  const amen = Object.entries(st.amen || {})
    .filter(([, a]) => a.selected !== false)
    .map(([id]) => S.AMENITY[id]?.l)
    .filter(Boolean);
  return {
    ...l,
    editor: l.editor,
    purpose: d.purpose,
    category: d.category,
    type: S.PTYPE_LABEL[d.ptype] || '',
    completion: c.land ? 'ready' : d.devStatus,
    emirate: d.emirate || 'Dubai',
    area: d.communityId || '',
    building: d.proposing ? d.propName || '' : d.buildingName || '',
    unit: d.unitNo || '',
    address: d.street || '',
    coordinates: d.lat && d.lng ? { lat: decimal(d.lat), lng: decimal(d.lng) } : undefined,
    floor: decimal(val('floorNo')),
    floorBand: val('floorBand'),
    size: Number.isFinite(area) ? area : '',
    plot: U.areaIn(val('plotArea'), 'sqft') || '',
    beds: c.resUnit
      ? d.bedrooms === 'studio'
        ? 0
        : decimal(d.bedrooms === 'custom' ? d.bedroomsCustom : d.bedrooms)
      : '',
    baths: c.resUnit ? decimal(d.bathrooms === 'custom' ? d.bathroomsCustom : d.bathrooms) : '',
    parking: c.land ? '' : decimal(d.parking === 'custom' ? d.parkingCustom : d.parking),
    furnishing: label('furnishing'),
    condition: label('condition'),
    occupancy: label('occupancy'),
    completionYear: decimal(val('completionYear')),
    ownership: label('tenure'),
    view: (val('views') || [])
      .map((v) => S.FIELDS.views.opts.find((o) => o.v === v)?.l)
      .filter(Boolean)
      .join(', '),
    title: val('title') || '',
    description: val('description') || '',
    price: money(val(priceKey)),
    cheques: c.rent ? (d.cheques || []).join(', ') : '',
    deposit: c.rent && d.depositBasis === 'pct' ? decimal(d.deposit) : '',
    availableFrom: c.rent ? (d.availability === 'now' ? 'Immediately' : d.availableFrom || '') : '',
    serviceCharge: val('serviceBasis') === 'per_sqft' ? money(val('serviceCharge')) : '',
    nearbyNote: val('locHighlights') || '',
    brokerRef: d.extRef || '',
    authorised: !!d.decl2,
    amenities: c.land ? [] : [...new Set([...(l.editor.legacyAmenities || []), ...amen])],
    display: { ...(l.display || {}), portfolioFeatured: d.promotion === 'featured' },
    permit: { ...(l.permit || {}), number: d.permitNo || '', expiry: d.permitExpiry || '' },
    media: { ...(l.media || {}), tour: val('tourUrl') || '' },
    offplan: {
      ...(l.offplan || {}),
      project: c.off ? (d.proposing ? d.propName : d.buildingName) || '' : '',
      developer: c.off ? d.developer || '' : '',
      handover: c.off && d.handoverQ && d.handoverY ? 'Q' + d.handoverQ + ' ' + d.handoverY : '',
      devStatus: label('stage'),
      plan,
    },
  };
}

export function validateEditorStep(n, l, user) {
  const st = editorState(l),
    c = S.ctxOf(st.d);
  const { errs } = S.validateListing(st);
  const keys = new Set(S.activeFieldKeys(c, st.d, n - 1));
  Object.entries(S.WIDGET_KEYS).forEach(([key, step]) => {
    if (step === n - 1) keys.add(key);
  });
  if (n === 2 && !st.d.emirate) errs.emirate = 'Choose an emirate.';
  if (n === 2) {
    keys.add('emirate');
    keys.add('buildingName');
    if (c.off && !st.d.proposing && !String(st.d.buildingName || '').trim())
      errs.buildingName = 'Enter the project name.';
  }
  if (
    n === 6 &&
    (l.media?.videos || []).some(
      (v) => !String(v.title || '').trim() || !v.url || (v.kind === 'link' && !U.parseVideoUrl(v.url)),
    )
  ) {
    errs.videos = 'Give every video a title and a valid YouTube / Vimeo link or uploaded file.';
  }
  if (n === 6 && l.media?.video && !U.parseVideoUrl(l.media.video)) {
    errs['media.video'] = 'Use a YouTube or Vimeo video link.';
    keys.add('media.video');
  }
  if ((n === 3 && !c.typeOk) || (n === 4 && !c.priceReady))
    return [{ key: 'classification', id: 'designer-classification', msg: 'Complete Classification before this step.' }];
  if (n === 7 && (user?.type === 'developer' || user?.type === 'owner') && !l.ownerDirect && !l.primaryBroker) {
    errs.primaryBroker = 'Choose the primary broker for this property.';
    keys.add('primaryBroker');
  }
  return Object.entries(errs)
    .filter(([key]) => keys.has(key))
    .map(([key, msg]) => ({
      key,
      id:
        key === 'primaryBroker'
          ? 'f-primary-broker'
          : key === 'photos'
            ? 'f-photos'
            : key === 'media.video'
              ? 'f-video'
              : 'designer-' + key,
      msg,
    }));
}

export function editorReadiness(l, user) {
  const checks = S.STEPS.slice(0, 7).map((step, i) => ({
    key: 'step-' + (i + 1),
    step: i + 1,
    label: step.title,
    ok: validateEditorStep(i + 1, l, user).length === 0,
  }));
  const complete = checks.every((c) => c.ok);
  checks.push({
    key: 'verified',
    step: 0,
    label: 'Professional credentials verified',
    ok: user?.credentialStatus === 'verified',
  });
  return { checks, complete, publishable: complete && user?.credentialStatus === 'verified' };
}
