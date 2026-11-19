import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brokerFacts, propertyFacts } from '../src/lib/seoAgent/facts';
import { hashFacts, seoTargets } from '../src/lib/seoAgent/targets';
import { factNumbers, numbersIn, validateSeoDraft, type SeoDraft } from '../src/lib/seoAgent/validate';

const listing = {
  id: 'p1',
  slug: 'marina-2-bed',
  status: 'published',
  display: { visible: true },
  title: '2-bedroom apartment in Dubai Marina',
  purpose: 'sale',
  type: 'Apartment',
  completion: 'ready',
  area: 'Dubai Marina',
  building: 'Marina Gate 1',
  price: 2450000,
  beds: 2,
  baths: 3,
  size: 1250,
  amenities: ['Pool', '24/7 security'],
  description: '<p>Bright apartment with marina views.</p>',
  permit: { number: 'P-123' },
  broker: { name: 'Sara Ali', agencyName: 'Bay Homes', brnVerified: true, isPublic: true },
  createdAt: '2026-10-01',
  updatedAt: '2026-11-01',
};

const facts = propertyFacts(listing);

const good: SeoDraft = {
  title: '2-bedroom apartment for sale in Dubai Marina',
  metaDescription: 'Ready 2-bedroom, 3-bathroom apartment of 1,250 sq ft in Marina Gate 1, Dubai Marina, asking AED 2,450,000.',
  faq: [
    { question: 'What is the asking price?', answer: 'The asking price is AED 2,450,000 (AED 2.45M).' },
    { question: 'How big is the apartment?', answer: 'It has two bedrooms, three bathrooms and 1,250 sq ft.' },
    { question: 'Is the building secure?', answer: 'Amenities listed include a pool and 24/7 security.' },
  ],
  issues: [],
};

test('numbers are read in every common format', () => {
  assert.deepEqual(numbersIn('AED 2.45M, 2,450,000 or 2.45 million'), [2450000, 2450000, 2450000]);
  assert.deepEqual(numbersIn('two bedrooms and one study'), [2]);
  assert.ok(factNumbers(facts).has(24) && factNumbers(facts).has(7), 'numbers inside fact strings count');
});

test('property facts are public, compact and hash stably', () => {
  assert.equal(facts.description, 'Bright apartment with marina views.');
  assert.equal(facts.permit, 'has an advertising permit number');
  assert.ok(!('createdAt' in facts) && !('updatedAt' in facts), 'volatile dates are left out');
  assert.equal(hashFacts(facts), hashFacts(propertyFacts({ ...listing, updatedAt: '2026-12-01' })));
  assert.notEqual(hashFacts(facts), hashFacts(propertyFacts({ ...listing, price: 2400000 })));
  assert.equal(propertyFacts({ ...listing, priceOnRequest: true }).priceAED, undefined);
  assert.equal(propertyFacts({ ...listing, beds: 0 }).bedrooms, 'studio');
  assert.equal(propertyFacts({ ...listing, type: 'Office', category: 'commercial', beds: 0 }).bedrooms, undefined, 'no studio offices');
});

test('a grounded draft passes', () => {
  assert.deepEqual(validateSeoDraft(good, facts), []);
});

test('invented numbers, claims and contact details are rejected', () => {
  const bad = (patch: Partial<SeoDraft>) => validateSeoDraft({ ...good, ...patch }, facts);
  assert.match(bad({ title: 'Marina apartment, 8% rental yield, AED 2.5M' }).join(' '), /2500000.*not in the facts/);
  assert.match(bad({ title: 'Marina apartment, 8% rental yield, AED 2.5M' }).join(' '), /rental yield/);
  assert.match(bad({ metaDescription: 'The best four-bedroom apartment in Dubai Marina with sea views and a pool for families.' }).join(' '), /superlatives/);
  assert.match(bad({ metaDescription: 'The best four-bedroom apartment in Dubai Marina with sea views and a pool for families.' }).join(' '), /contains 4/);
  assert.match(bad({ faq: [...good.faq, { question: 'How do I contact the broker?', answer: 'Call +971 50 123 4567 today.' }] }).join(' '), /phone number/);
  assert.match(bad({ title: 'Marina apartment | Emirate08' }).join(' '), /site name/);
  assert.match(bad({ faq: good.faq.slice(0, 2) }).join(' '), /3–5 FAQ/);
});

test('targets cover public listings and broker profiles only', () => {
  const brokers = [{ id: 'b1', slug: 'sara-ali', name: 'Sara Ali', type: 'broker', areas: ['Dubai Marina'], brnVerified: true }];
  const targets = seoTargets({ listings: [listing, { ...listing, id: 'p2', slug: 'hidden', status: 'draft' }] }, brokers);
  assert.deepEqual(targets.map((t) => t.path), ['/property/marina-2-bed', '/brokers/sara-ali']);
  assert.equal(brokerFacts(brokers[0]).reraRegistrationVerified, true);
});

test('listing rewrites follow the same grounding rules, within the editor limits', async () => {
  const { validateListingRewrite } = await import('../src/lib/seoAgent/validate');
  const description =
    'A bright 2-bedroom apartment in Marina Gate 1, Dubai Marina, with 3 bathrooms and 1,250 sq ft of living space. ' +
    'Residents have a pool and 24/7 security. The asking price is AED 2,450,000, and the home is ready to move into.';
  assert.deepEqual(validateListingRewrite({ listingTitle: '2-bedroom apartment for sale in Marina Gate 1', listingDescription: description }, facts), []);
  const bad = validateListingRewrite({ listingTitle: 'Best 2-bed', listingDescription: description + ' Expect an 8% yield. Call +971 50 123 4567.' }, facts).join(' ');
  assert.match(bad, /listing title is 10 characters/);
  assert.match(bad, /superlatives/);
  assert.match(bad, /rental yield/);
  assert.match(bad, /phone number/);
});

test('saved SEO stops passing once the listing it quotes changes', () => {
  // The public page shows a listing's own SEO only while it validates against the current facts.
  assert.deepEqual(validateSeoDraft(good, facts), []);
  const repriced = propertyFacts({ ...listing, price: 2300000 });
  assert.match(validateSeoDraft(good, repriced).join(' '), /2450000.*not in the facts/);
});
