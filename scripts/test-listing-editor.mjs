import assert from 'node:assert/strict';
import test from 'node:test';
import { listingSchema as S } from '../src/components/listings/editor/designer-schema.js';
import {
  hydrateEditor,
  projectListing,
  validateEditorStep,
  editorReadiness,
} from '../src/components/listings/editor/designer-model.js';
import { publicListing } from '../src/lib/publicListing.js';

function listing(changes = {}) {
  const base = hydrateEditor({
    category: 'residential',
    photos: [{ src: 'https://example.com/photo.jpg', imgType: 'actual' }],
    featured: 'https://example.com/photo.jpg',
    media: { floorplans: [] },
    highlights: [],
    amenities: [],
    permit: {},
    offplan: { plan: [] },
    display: {},
  });
  base.editor.d = {
    ...base.editor.d,
    purpose: 'sale',
    category: 'residential',
    ptype: 'apartment',
    devStatus: 'ready',
    txn: 'resale',
    emirate: 'Dubai',
    communityId: 'Dubai Marina',
    buildingName: 'Marina residence',
    bedrooms: 'studio',
    bathrooms: '1',
    unitArea: { raw: '1200', unit: 'sqft' },
    furnishing: 'unfurnished',
    occupancy: 'vacant',
    tenure: 'freehold',
    askingPrice: '1250000.50',
    possession: 'now',
    title: 'Studio apartment in Dubai Marina',
    description: 'A spacious studio apartment with an open layout in Dubai Marina.',
    mediaRights: true,
    permitNo: 'ISSUED-123',
    authType: 'owner_agreement',
    floorDisplay: 'hidden',
    decl1: true,
    decl2: true,
    decl3: true,
    ...changes,
  };
  return projectListing(base);
}

test('ready studio sale can traverse all eight steps and publish', () => {
  const l = listing();
  for (let n = 1; n <= 8; n++) assert.deepEqual(validateEditorStep(n, l), [], 'step ' + n);
  assert.equal(l.beds, 0);
  assert.equal(l.price, 1250000.5);
  assert.equal(editorReadiness(l, { credentialStatus: 'verified' }).publishable, true);
});

test('marketing is validated in step five, declarations in step eight', () => {
  const l = listing({ title: '', description: '', decl2: false });
  assert.equal(validateEditorStep(3, l).length, 0);
  assert.deepEqual(
    validateEditorStep(5, l).map((e) => e.key),
    ['title', 'description'],
  );
  assert.ok(validateEditorStep(8, l).some((e) => e.key === 'decl2'));
});

test('land omits residential and development questions and uses plot area', () => {
  const l = listing({
    category: 'land',
    ptype: 'residential_plot',
    devStatus: '',
    bedrooms: '',
    bathrooms: '',
    furnishing: '',
    occupancy: '',
    plotArea: { raw: '500', unit: 'sqm' },
  });
  assert.deepEqual(validateEditorStep(1, l), []);
  assert.deepEqual(validateEditorStep(3, l), []);
  assert.equal(l.category, 'land');
  assert.equal(l.type, 'Residential plot');
  assert.ok(Math.abs(l.size - 5381.955208) < 0.001);
  assert.equal(l.beds, '');
});

test('commercial journeys ask their own required fields', () => {
  const expected = {
    office: 'officeFit',
    shop: null,
    warehouse: null,
    factory: null,
    commercial_building: null,
    labour_accommodation: null,
  };
  for (const [ptype, required] of Object.entries(expected)) {
    const l = listing({
      category: 'commercial',
      ptype,
      bedrooms: '',
      bathrooms: '',
      furnishing: '',
      builtUpArea: { raw: '4000', unit: 'sqft' },
    });
    assert.equal(
      validateEditorStep(3, l).some((e) => e.key === 'bedrooms'),
      false,
    );
    assert.equal(
      validateEditorStep(3, l).some((e) => e.key === 'bathrooms'),
      false,
    );
    if (required) assert.ok(validateEditorStep(3, l).some((e) => e.key === required));
  }
});

test('rent uses accepted cheque arrangements and separates deposit from recurring rent', () => {
  const l = listing({
    purpose: 'rent',
    annualRent: '120000',
    availability: 'now',
    cheques: ['1', '4'],
    depositBasis: 'pct',
    deposit: '5',
  });
  l.editor.cheqAmts = { 4: '124000' };
  assert.deepEqual(validateEditorStep(4, l), []);
  const summary = S.pricing.rent({ ...l.editor });
  assert.equal(summary.rent, 12000000);
  assert.equal(summary.deposit, 'AED 6,000 (5% of annual rent)');
  assert.ok(summary.payLines[1].v.includes('31,000'));
  assert.equal(
    validateEditorStep(1, listing({ purpose: 'rent', devStatus: 'offplan', stage: 'under_construction' })).some(
      (e) => e.key === 'devStatus',
    ),
    true,
  );
});

test('initial off-plan booking is counted once and payment mismatches block progression', () => {
  const l = listing({
    devStatus: 'offplan',
    stage: 'under_construction',
    txn: 'initial',
    developer: 'Developer',
    handoverQ: '4',
    handoverY: String(new Date().getFullYear() + 1),
    unitPrice: '1000000',
    bookingBasis: 'pct',
    booking: '10',
    bookingInSchedule: false,
  });
  l.editor.milestones = [
    { id: 'a', name: 'Construction', mode: 'pct', value: '50', trigger: 'construction', when: 'During construction' },
    { id: 'b', name: 'Handover', mode: 'pct', value: '40', trigger: 'handover' },
  ];
  assert.deepEqual(validateEditorStep(4, l), []);
  const projected = projectListing(l);
  assert.equal(
    projected.offplan.plan.reduce((s, m) => s + m.pct, 0),
    100,
  );
  l.editor.d.bookingInSchedule = true;
  assert.ok(validateEditorStep(4, l).some((e) => e.key === 'milestones'));
});

test('off-plan resale requires explicit price basis without requiring an initial-sale payment schedule', () => {
  const l = listing({
    devStatus: 'offplan',
    stage: 'under_construction',
    txn: 'resale',
    developer: 'Developer',
    handoverQ: '4',
    handoverY: String(new Date().getFullYear() + 1),
    transferElig: 'unknown',
    priceBasis: 'seller',
    priceIncludes: 'Payable to seller; developer balance is additional.',
    outstanding: '250000',
    payToSeller: '1250000.50',
  });
  assert.deepEqual(validateEditorStep(4, l), []);
  assert.equal(S.pricing.resale(l.editor).total, 150000050);
  l.editor.d.priceBasis = '';
  assert.ok(validateEditorStep(4, l).some((e) => e.key === 'priceBasis'));
});

test('area unit switching retains exact entered data and hidden answers survive draft reload', () => {
  const l = listing({ unitArea: { raw: '1200.125', unit: 'sqft' }, areaUnit: 'sqm', notes: 'Private notes' });
  assert.equal(l.size, 1200.125);
  assert.deepEqual(l.editor.d.unitArea, { raw: '1200.125', unit: 'sqft' });
  l.editor.d.category = 'land';
  l.editor.d.ptype = 'residential_plot';
  l.editor.d.plotArea = { raw: '4000', unit: 'sqft' };
  const restored = projectListing(hydrateEditor(JSON.parse(JSON.stringify(projectListing(l)))));
  assert.equal(restored.beds, '');
  assert.equal(restored.editor.d.bedrooms, 'studio');
  assert.equal(restored.editor.d.notes, 'Private notes');
});

test('public listing and nested CMS snapshots omit private answers and obey location/floor precision', () => {
  const l = listing({
    unitNo: 'PRIVATE-UNIT',
    extRef: 'SECRET-CRM',
    notes: 'SECRET-NOTES',
    floorNo: '27',
    floorBand: 'high',
    floorDisplay: 'band',
    locPrecision: 'approximate',
    lat: '25.08',
    lng: '55.14',
    originalPrice: 'SECRET-PRICE',
  });
  l.permit.document = { url: 'https://example.com/PRIVATE-DOCUMENT' };
  const clean = publicListing({ ...l, appData: l });
  const json = JSON.stringify(clean);
  for (const secret of [
    'PRIVATE-UNIT',
    'SECRET-CRM',
    'SECRET-NOTES',
    'SECRET-PRICE',
    'PRIVATE-DOCUMENT',
    'Marina residence',
  ])
    assert.equal(json.includes(secret), false, secret);
  assert.equal(clean.floor, undefined);
  assert.equal(clean.floorBand, 'High floor');
  assert.equal(clean.coordinates, undefined);
  assert.equal(clean.editor, undefined);
});

test('developer representation requires a primary broker when owner-direct is disabled', () => {
  const l = listing();
  l.ownerType = 'developer';
  l.ownerDirect = false;
  assert.ok(validateEditorStep(7, l, { type: 'developer' }).some((e) => e.key === 'primaryBroker'));
  l.primaryBroker = '5';
  assert.deepEqual(validateEditorStep(7, l, { type: 'developer' }), []);
  l.ownerDirect = true;
  l.primaryBroker = '';
  assert.deepEqual(validateEditorStep(7, l, { type: 'developer' }), []);
});

test('existing listings upgrade without losing amenities or external location names', () => {
  const old = {
    category: 'residential',
    type: 'Apartment',
    completion: 'ready',
    beds: 2,
    baths: 2,
    size: 1200,
    area: 'New community',
    amenities: ['Balcony', 'Legacy feature'],
    photos: [],
    offplan: { plan: [] },
    media: {},
    display: {},
  };
  const l = projectListing(hydrateEditor(old));
  assert.equal(l.area, 'New community');
  assert.deepEqual(l.amenities.sort(), ['Balcony', 'Legacy feature']);
  assert.equal(l.editor.d.bedrooms, '2');
});

// Additional acceptance checks from EMIRATE08_V5_Dropped_Items.pdf (pages 5-7).
test('photo duplicate identity uses file bytes rather than names', async () => {
  const { photoHash } = await import('../src/components/listings/editor/photoChecks.js');
  const first = new File(['same original image'], 'living.jpg', { type: 'image/jpeg' });
  const renamed = new File(['same original image'], 'renamed.jpg', { type: 'image/jpeg' });
  const different = new File(['different image'], 'living.jpg', { type: 'image/jpeg' });
  assert.equal(await photoHash(first), await photoHash(renamed));
  assert.notEqual(await photoHash(first), await photoHash(different));
});

test('low-resolution guidance is non-blocking and checks original dimensions', async () => {
  const { photoQuality } = await import('../src/components/listings/editor/photoChecks.js');
  assert.equal(photoQuality(1279, 720).lowResolution, true);
  assert.equal(photoQuality(1280, 719).lowResolution, true);
  assert.equal(photoQuality(1280, 720).lowResolution, false);
  const l = listing();
  l.photos[0] = { ...l.photos[0], ...photoQuality(640, 480) };
  assert.deepEqual(validateEditorStep(6, l), []);
  l.photos[0].imgType = 'render';
  assert.ok(validateEditorStep(6, l).some((error) => error.key === 'photos'));
});

test('floor-plan levels and itemised charge notes survive draft reload and public projection', () => {
  const l = listing();
  l.media.floorplans = [
    { src: 'https://example.com/plan.pdf', mimetype: 'application/pdf', name: 'Type 2B', level: 'Ground floor' },
  ];
  l.editor.extraTerms = [
    {
      id: 'term-1',
      label: 'Access card',
      amount: '250',
      freq: 'One time',
      payer: 'Buyer',
      notes: 'Refundable when returned',
    },
  ];
  l.editor.d.notes = 'PRIVATE broker negotiation notes';
  const restored = projectListing(hydrateEditor(JSON.parse(JSON.stringify(l))));
  const publicModel = publicListing(restored);
  assert.equal(publicModel.media.floorplans[0].level, 'Ground floor');
  assert.equal(publicModel.additionalTerms[0].notes, 'Refundable when returned');
  assert.equal(JSON.stringify(publicModel).includes('PRIVATE broker negotiation notes'), false);
});


test('broker editing a developer-owned record is never blocked by a hidden primary-broker selector', () => {
  const l = listing();
  l.ownerType = 'developer';
  l.ownerDirect = false;
  l.primaryBroker = '';
  const broker = { type: 'broker', credentialStatus: 'verified' };
  assert.deepEqual(validateEditorStep(7, l, broker), []);
  assert.equal(editorReadiness(l, broker).complete, true);
  assert.equal(editorReadiness(l, broker).publishable, true);
  assert.ok(validateEditorStep(7, l, { type: 'developer' }).some((error) => error.key === 'primaryBroker'));
  assert.ok(validateEditorStep(7, l, { type: 'owner' }).some((error) => error.key === 'primaryBroker'));
});
