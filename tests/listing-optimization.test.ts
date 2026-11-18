import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listingSchema as S } from '../src/components/listings/editor/designer-schema';
import { deriveEditor, qualityScore } from '../src/components/listings/editor/listing-derive';
import { hydrateEditor, projectListing, validateEditorStep } from '../src/components/listings/editor/designer-model';
import { blankListing, prepare } from '../src/components/listings/editor/model';
import { buildCatalogue, searchCatalogue } from '../src/lib/listingCatalogue';
import { aiNumber, cleanListingSuggestions } from '../src/lib/listingAutofill';
import { publicListing } from '../src/lib/publicListing';
import { listingJsonLd } from '../src/lib/listingJsonLd';

function draft(d: Record<string, any>, extra: Record<string, any> = {}) {
  const l = hydrateEditor(prepare(blankListing()));
  return { ...l, ...extra, editor: { ...l.editor, ...(extra.editor || {}), d: { ...l.editor.d, ...d } } };
}
const apartment = { purpose: 'sale', category: 'residential', ptype: 'apartment', devStatus: 'ready', txn: 'resale' };

test('floor band is worked out from the floor number and building floors', () => {
  const e = deriveEditor(draft({ ...apartment, floorNo: '30', totalFloors: '40' }).editor);
  assert.equal(e.d.floorBand, 'high');
  assert.equal(e.sources.floorBand, 'computed');
  assert.equal(deriveEditor(draft({ ...apartment, floorNo: '0', totalFloors: '40' }).editor).d.floorBand, 'ground');
  assert.equal(deriveEditor(draft({ ...apartment, floorNo: '5', totalFloors: '40' }).editor).d.floorBand, 'low');
});

test('a new listing has no emirate until one is chosen or worked out from the community', () => {
  const fresh = projectListing(draft({}));
  assert.equal(fresh.editor.d.emirate, '');
  const keys = validateEditorStep(2, fresh, { type: 'broker' }).map((e) => e.key);
  assert.ok(keys.includes('emirate'));
  assert.equal(deriveEditor(draft({ communityId: 'Saadiyat Island' }).editor).d.emirate, 'Abu Dhabi');
  assert.equal(deriveEditor(draft({ communityId: 'Palm Jebel Ali' }).editor).d.emirate, 'Dubai');
  // A name used in more than one emirate is not guessed.
  assert.equal(deriveEditor(draft({ communityId: 'Al Nahda' }).editor).d.emirate, '');
  // An emirate the user picked is never replaced.
  assert.equal(deriveEditor(draft({ emirate: 'Sharjah', communityId: 'Dubai Marina' }).editor).d.emirate, 'Sharjah');
});

test('a derived answer the user changed is never overwritten', () => {
  let e = deriveEditor(draft({ ...apartment, occupancy: 'vacant' }).editor);
  assert.equal(e.d.possession, 'now');
  e = deriveEditor({ ...e, d: { ...e.d, possession: 'expected' } });
  assert.equal(e.d.possession, 'expected');
  e = deriveEditor({ ...e, d: { ...e.d, occupancy: 'tenanted' } });
  assert.equal(e.d.possession, 'expected', 'user choice survives later changes');
  // An untouched derived answer follows its inputs.
  let f = deriveEditor(draft({ ...apartment, occupancy: 'vacant' }).editor);
  f = deriveEditor({ ...f, d: { ...f.d, occupancy: 'tenanted' } });
  assert.equal(f.d.possession, 'subject_tenancy');
  assert.equal(f.d.viewing, 'restricted');
});

test('account presets fill commission only when a value is set, and rental deposits default by furnishing', () => {
  const presets = { sale: { commBasis: 'pct', commission: '' }, rent: { commBasis: 'pct', commission: '5', commPayer: 'tenant' } };
  const sale = deriveEditor({ ...draft(apartment).editor, presets });
  assert.equal(sale.d.commBasis || '', '', 'basis alone would make commission required');
  const rent = deriveEditor({
    ...draft({ ...apartment, purpose: 'rent', txn: '', annualRent: '120000', furnishing: 'furnished' }).editor,
    presets,
  });
  assert.equal(rent.d.commission, '5');
  assert.equal(rent.d.commPayer, 'tenant');
  assert.equal(rent.d.depositBasis, 'pct');
  assert.equal(rent.d.deposit, '10');
  assert.equal(rent.sources.commission, 'defaults');
});

test('removed parking-type and storage answers move into amenities', () => {
  const e = deriveEditor(draft({ ...apartment, parkingType: ['covered'], extraRooms: ['maid', 'storage'] }).editor);
  assert.ok(e.amen.covered_parking?.selected);
  assert.ok(e.amen.storage?.selected);
  assert.deepEqual(e.d.extraRooms, ['maid']);
});

test('projection stores price per sq ft, both service-charge bases, developer and market status', () => {
  const l = projectListing(
    draft({
      ...apartment,
      emirate: 'Dubai',
      communityId: 'Dubai Marina',
      subcommunity: 'Marina Promenade',
      buildingName: 'Test Tower',
      developer: 'Example Developments',
      unitArea: { raw: '1000', unit: 'sqft' },
      askingPrice: '2000000',
      serviceCharge: '18000',
      serviceBasis: 'per_year',
    }),
  );
  assert.equal(l.pricePerSqft, 2000);
  assert.equal(l.sizeSqm, 93);
  assert.equal(l.serviceChargeAnnual, 18000);
  assert.equal(l.serviceChargePerSqft, 18);
  assert.equal(l.developer, 'Example Developments', 'developer kept for ready listings');
  assert.equal(l.subcommunity, 'Marina Promenade');
  assert.equal(l.marketStatus, 'ready-resale');
  assert.equal(l.issuingAuthority, S.permitAuthority('Dubai').name);
});

test('a new listing starts with every choice unanswered; saved legacy records keep their fallbacks', () => {
  const d = projectListing(hydrateEditor(prepare(blankListing()))).editor.d;
  for (const key of Object.keys(S.FIELDS)) {
    const f = S.FIELDS[key];
    // areaUnit is the sq ft / sq m display preference, not a question about the property.
    if (['seg', 'select', 'multi'].includes(f.kind) && key !== 'areaUnit')
      assert.ok(S.util.isBlank(d[key]), `${key} should start empty but was ${JSON.stringify(d[key])}`);
  }
  const legacy = hydrateEditor(prepare({ ...blankListing(), id: 'old-1', ownership: '' })).editor.d;
  assert.equal(legacy.category, 'residential');
  assert.equal(legacy.tenure, 'freehold');
});

test('new drafts leave the booking basis open; legacy AED bookings keep AED', () => {
  assert.equal(hydrateEditor(prepare(blankListing())).editor.d.bookingBasis, '');
  const legacy = hydrateEditor(prepare({ ...blankListing(), offplan: { booking: 50000, plan: [] } }));
  assert.equal(legacy.editor.d.bookingBasis, 'aed');
});

test('a booking row in the payment schedule is not counted twice', () => {
  const st = {
    d: { ...S.defaultData(), unitPrice: '1000000', bookingBasis: 'pct', booking: '10' },
    milestones: [
      { id: 'a', name: 'Booking', mode: 'pct', value: '10', trigger: 'booking' },
      { id: 'b', name: 'Handover', mode: 'pct', value: '90', trigger: 'handover' },
    ],
  };
  const schedule = S.pricing.schedule(st);
  assert.equal(schedule.includeBooking, false);
  assert.equal(schedule.ok, true);
});

test('agency-free validation: market status is required for a sale', () => {
  const l = projectListing(draft({ purpose: 'sale', category: 'residential', ptype: 'apartment' }));
  const keys = validateEditorStep(1, l, { type: 'broker' }).map((e) => e.key);
  assert.ok(keys.includes('devStatus'));
  assert.ok(keys.includes('txn'));
});

test('catalogue aggregates building facts and excludes private or approximate listings', () => {
  const doc = (d: Record<string, any>, amen: Record<string, any> = {}, extra: Record<string, any> = {}) => ({
    status: 'published',
    ...extra,
    appData: { editor: { d: { ...apartment, emirate: 'Dubai', communityId: 'Dubai Marina', ...d }, amen } },
  });
  const docs = [
    doc({ buildingName: 'Test Tower', developer: 'Dev A', unitNo: '1204', lat: '25.08', lng: '55.14', serviceCharge: '15', serviceBasis: 'per_sqft', totalFloors: '40' }, { sh_pool: { selected: true }, sh_gym: { selected: true } }),
    doc({ buildingName: 'Test Tower', developer: 'Dev A', unitNo: '3301', serviceCharge: '17', serviceBasis: 'per_sqft' }, { sh_pool: { selected: true }, balcony: { selected: true } }),
    doc({ buildingName: 'Hidden Tower', locPrecision: 'approximate' }),
  ];
  const catalogue = buildCatalogue(docs);
  assert.equal(catalogue.length, 1);
  const b = catalogue[0];
  assert.equal(b.name, 'Test Tower');
  assert.equal(b.developer, 'Dev A');
  assert.equal(b.serviceChargePerSqft, 16);
  assert.equal(b.totalFloors, '40');
  assert.equal(b.lat, '25.08', 'blank coordinates are ignored');
  assert.deepEqual(b.sharedAmenities.sort(), ['sh_gym', 'sh_pool']);
  assert.ok(!JSON.stringify(b).includes('1204'), 'unit numbers never leave the catalogue');
  assert.equal(searchCatalogue(catalogue, 'test tow')[0]?.name, 'Test Tower');
  assert.equal(searchCatalogue(catalogue, 'test', 'Abu Dhabi').length, 0);
});

test('AI non-answers ("More than 10", "Unknown") are never filled in', () => {
  const out = cleanListingSuggestions({
    purpose: 'sale',
    category: 'residential',
    ptype: 'villa',
    bedrooms: ['3', '4', '5'],
    bathrooms: 'custom',
    parking: 'unknown',
    builtUpArea: { raw: '2328.6', rawMax: '4921.4', unit: 'sqft' },
  });
  assert.equal(out.bathrooms, undefined);
  assert.equal(out.parking, undefined);
  assert.deepEqual(out.bedroomsMulti, ['3', '4', '5']);
  assert.deepEqual(out.builtUpArea, { raw: '2328.6', rawMax: '4921.4', unit: 'sqft' });
});

test('private document answers are only accepted when allowed', () => {
  const input = { unitNo: '1204', permitNo: '7112345678', title: 'Two bedroom apartment' };
  assert.deepEqual(Object.keys(cleanListingSuggestions(input)).sort(), ['title']);
  assert.deepEqual(Object.keys(cleanListingSuggestions(input, { allowPrivate: true })).sort(), ['permitNo', 'title', 'unitNo']);
});

test('public listing hides the price on request and keeps only genuine price drops', () => {
  const hidden = publicListing({ title: 'A', price: 2000000, priceOnRequest: true, pricePerSqft: 2000, previousPrice: 2100000 });
  assert.equal(hidden.price, undefined);
  assert.equal(hidden.pricePerSqft, undefined);
  const raised = publicListing({ title: 'B', price: 2100000, previousPrice: 2000000, priceHistory: [{ price: 2000000 }] });
  assert.equal(raised.previousPrice, undefined);
  assert.equal(raised.priceHistory, undefined);
  const dropped = publicListing({ title: 'C', price: 1900000, previousPrice: 2000000 });
  assert.equal(dropped.previousPrice, 2000000);
});

test('JSON-LD describes the listing as a RealEstateListing with an offer', () => {
  const [listing, crumbs] = listingJsonLd({
    slug: 'two-bed',
    title: 'Two bed',
    purpose: 'sale',
    type: 'Apartment',
    price: 2000000,
    size: 1000,
    beds: 2,
    baths: 3,
    area: 'Dubai Marina',
    emirate: 'Dubai',
    amenities: ['Balcony'],
  }) as any[];
  assert.equal(listing['@type'], 'RealEstateListing');
  assert.equal(listing.offers.priceCurrency, 'AED');
  assert.equal(listing.about['@type'], 'Apartment');
  assert.equal(listing.about.numberOfBedrooms, 2);
  assert.equal(crumbs['@type'], 'BreadcrumbList');
});

test('quality score rewards photos, Arabic copy and floor plans', () => {
  const low = qualityScore(draft(apartment, { photos: [] }));
  const high = qualityScore(
    draft(
      { ...apartment, description: 'x'.repeat(450), altTitle: 'عنوان', altDesc: 'وصف', lat: '25', lng: '55' },
      {
        photos: Array.from({ length: 9 }, (_, i) => ({ src: 'p' + i })),
        highlights: ['a', 'b', 'c'],
        amenities: ['1', '2', '3', '4', '5'],
        media: { floorplans: [{ src: 'f' }], tour: 'https://kuula.co/share/abc' },
      },
    ),
  );
  assert.ok(low.score < 30);
  assert.equal(high.score, 100);
});

test('AI prices with separators or suffixes are kept, in the field the classification uses', () => {
  assert.deepEqual(['25,387,028', 'AED 1,200,000', '2.46M', '850K', '10%', 'abc', 12].map(aiNumber), ['25387028', '1200000', '2460000', '850000', '10', '', '12']);
  // Bayut off-plan "Initial Sale" page: the model returned the headline price as askingPrice.
  const offInit = cleanListingSuggestions({ purpose: 'sale', category: 'residential', ptype: 'villa', devStatus: 'offplan', txn: 'initial', askingPrice: '25,387,028' });
  assert.equal(offInit.unitPrice, '25387028');
  assert.equal(offInit.askingPrice, undefined);
  const resale = cleanListingSuggestions({ purpose: 'sale', category: 'residential', ptype: 'apartment', devStatus: 'ready', txn: 'resale', unitPrice: '2460000' });
  assert.equal(resale.askingPrice, '2460000');
  assert.equal(resale.unitPrice, undefined);
});

test('workspace saves only rewrite listings that were actually edited', async () => {
  const { listingEdited } = await import('../src/lib/server/member-properties');
  const stored = { updatedAt: '2026-11-10T08:00:00.000Z', appData: { updatedAt: '2026-11-10T07:59:59.900Z' } };
  // Loaded after a refresh: carries the database timestamp.
  assert.equal(listingEdited({ updatedAt: '2026-11-10T08:00:00.000Z' }, stored), false);
  // Saved earlier this session: carries the stamp written into its snapshot.
  assert.equal(listingEdited({ updatedAt: '2026-11-10T07:59:59.900Z' }, stored), false);
  // Edited now: new stamp.
  assert.equal(listingEdited({ updatedAt: '2026-11-17T09:00:00.000Z' }, stored), true);
  // New or unstamped listings are always written.
  assert.equal(listingEdited({ updatedAt: '2026-11-17T09:00:00.000Z' }, undefined), true);
  assert.equal(listingEdited({}, stored), true);
});

test('permit expiry is required on the permit step', () => {
  assert.equal(S.FIELDS.permitExpiry.req, true);
});

test('page classification trusts the portal record over agent tags', async () => {
  const { pageClassification } = await import('../src/lib/listingAutofillServer');
  // Property Finder: agent tag "Offplan: Re-Sale" but the project card says Completed, delivered Q3 2023.
  const pf = '1. [Lamar Residences]\nSuperAgent\nOffplan: Re-Sale\n21\n1,553,000\n## Project information\n[Lamar Residence]\nCompleted\nLamar Residence\nDeveloped by:\n[Aabar Properties]\nDelivery Date:\nQ3 2023\nDown payment:\n20%\n';
  assert.deepEqual(pageClassification(pf, '2026-11-17'), { devStatus: 'ready', txn: 'resale', delivery: '2023-09-30' });
  // Bayut: Completion status Off-Plan, handover Q1 2028, "Initial Sale" line.
  const bayut = 'Initial Sale\nProperty Information\nType\nVilla\nCompletion\nOff-Plan\nHandover date\nQ1 2028\n';
  assert.deepEqual(pageClassification(bayut, '2026-11-17'), { devStatus: 'offplan', txn: 'initial', delivery: '2028-03-31' });
  // A nav link or a description word alone forces nothing.
  assert.deepEqual(pageClassification('[Buy][Rent][Off-plan]\nGreat resale value in this ready community.', '2026-11-17'), { devStatus: '', txn: '', delivery: '' });
});

test('AI field spec carries a hint per field and options for every kind of listing', async () => {
  const { listingAiFieldSpec, LISTING_AI_FIELDS, LISTING_AI_PRIVATE_FIELDS } = await import('../src/lib/listingAutofill');
  const spec = listingAiFieldSpec(true);
  const byKey = Object.fromEntries(spec.map((field) => [field.key, field]));
  for (const key of [...LISTING_AI_FIELDS, ...LISTING_AI_PRIVATE_FIELDS, 'milestones']) assert.ok(byKey[key]?.hint, `hint for ${key}`);
  // Options are gathered across contexts: rent payers and commercial / land types are listed too.
  assert.ok(byKey.commPayer.options?.tenant && byKey.commPayer.options?.buyer);
  assert.ok(byKey.ptype.options?.office && byKey.ptype.options?.residential_plot);
  assert.equal(byKey.floorBand.options?.mid, 'Mid floor');
  // Non-answers are never offered.
  assert.equal(byKey.bedrooms.options?.custom, undefined);
  assert.equal(byKey.parking.options?.unknown, undefined);
  // Private fields are only in the spec for uploaded documents.
  assert.ok(!listingAiFieldSpec(false).some((field) => LISTING_AI_PRIVATE_FIELDS.includes(field.key)));
});

test('AI output schema only accepts known keys and the supplied source labels', async () => {
  const { listingAiOutputSchema } = await import('../src/lib/listingAutofill');
  const schema: any = listingAiOutputSchema(false, ['brochure.pdf', 'Pasted text']);
  const source = schema.properties.sources.items;
  assert.deepEqual(source.properties.label.enum, ['brochure.pdf', 'Pasted text']);
  const keys = source.properties.fields.items.properties.key.enum;
  assert.ok(keys.includes('askingPrice') && keys.includes('unitPriceMax') && keys.includes('milestones'));
  assert.ok(!keys.includes('permitNo'));
  // Structured outputs need every object closed and every property required.
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
    }
    Object.values(node).forEach(walk);
  };
  walk(schema);
});

test('AI answers without evidence in a text source are dropped', async () => {
  const { rowsToSuggestions, cleanListingSuggestions } = await import('../src/lib/listingAutofill');
  const { dropUnsupported, evidenceIn } = await import('../src/lib/listingAutofillServer');
  const page = 'Dubai > Palm Jumeirah > Golden Mile\n**AED 2.46M**\n3 Beds | 2 Baths\nAmenities: Shared Pool, Covered Parking';
  const { suggestions, evidence } = rowsToSuggestions([
    { key: 'communityId', value: 'Palm Jumeirah', evidence: 'Dubai > Palm  Jumeirah' },
    { key: 'askingPrice', value: '2460000', evidence: 'AED 2.46M' },
    { key: 'bathrooms', value: '4', evidence: '4 Baths' }, // not on the page
    { key: 'parking', value: '1', evidence: '' }, // no quote at all
    { key: 'amenities', value: ['sh_pool', 'covered_parking', 'sh_gym'], evidence: 'Shared Pool | Covered Parking | Shared Gym' },
    { key: 'description', value: 'A rewritten description.', evidence: 'something else' },
    { key: 'communityId', value: 'Ignored duplicate', evidence: 'x' },
  ]);
  assert.equal(suggestions.communityId, 'Palm Jumeirah');
  assert.deepEqual(dropUnsupported(suggestions, evidence, page).sort(), ['bathrooms', 'parking']);
  // Lists are kept on a partial match; free text is not quote-checked.
  assert.ok(suggestions.amenities && suggestions.description);
  assert.deepEqual(evidenceIn('3 Beds … 2 Baths', page), { all: true, any: true });
  assert.equal(cleanListingSuggestions(suggestions).askingPrice, '2460000');
});

test('portal facts are passed to the model as a short line', async () => {
  const { portalFacts, extractionPrompt } = await import('../src/lib/listingAutofillServer');
  assert.equal(portalFacts('Initial Sale\nCompletion\nOff-Plan\nHandover date\nQ1 2028\n', '2026-11-17'), 'devStatus offplan; txn initial (sale only); delivery / handover date 2028-03-31');
  assert.equal(portalFacts('Nothing structured here.', '2026-11-17'), '');
  // The system prompt has no date in it, so it is the same for every request and can be cached.
  assert.equal(extractionPrompt(false), extractionPrompt(false));
  assert.doesNotMatch(extractionPrompt(true), /\d{4}-\d{2}-\d{2}/);
});
