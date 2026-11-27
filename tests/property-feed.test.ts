import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FEED,
  applyFeedChange,
  canUseFeedAccount,
  findFeedProperty,
  isInFeed,
  normalizeFeedConfig,
  queryFeed,
  readFeedChange,
  readFeedQuery,
  toFeedProperty,
  EMBED_ENQUIRY_PATH,
  findTeamMember,
  toFeedTeamMember,
} from '../src/lib/propertyFeed';

const published = ['a', 'b', 'c', 'd'];

test('every published property is in a new feed, including ones published later', () => {
  const feed = normalizeFeedConfig(null);
  assert.deepEqual(feed, DEFAULT_FEED);
  for (const id of [...published, 'published-tomorrow']) assert.equal(isInFeed(feed, id), true);
});

test('removing and re-adding properties updates the exclusion list', () => {
  let feed = applyFeedChange(DEFAULT_FEED, { action: 'exclude', ids: ['a', 'c'] }, published);
  assert.deepEqual(feed.excluded, ['a', 'c']);
  assert.equal(isInFeed(feed, 'a'), false);
  assert.equal(isInFeed(feed, 'b'), true);
  feed = applyFeedChange(feed, { action: 'include', ids: ['a'] }, published);
  assert.deepEqual(feed.excluded, ['c']);
});

test('turning auto-include off keeps the same properties and leaves new ones out', () => {
  const removed = applyFeedChange(DEFAULT_FEED, { action: 'exclude', ids: ['b'] }, published);
  const manual = applyFeedChange(removed, { action: 'settings', autoIncludeNew: false }, published);
  assert.equal(manual.autoIncludeNew, false);
  assert.deepEqual(manual.included, ['a', 'c', 'd']);
  assert.equal(isInFeed(manual, 'b'), false);
  assert.equal(isInFeed(manual, 'new-listing'), false);
  const back = applyFeedChange(manual, { action: 'settings', autoIncludeNew: true }, [...published, 'new-listing']);
  assert.deepEqual(back.excluded, ['b', 'new-listing']);
  assert.equal(isInFeed(back, 'a'), true);
});

test('IDs of withdrawn listings are dropped and reset includes everything', () => {
  const feed = applyFeedChange({ ...DEFAULT_FEED, excluded: ['gone'] }, { action: 'exclude', ids: ['a'] }, published);
  assert.deepEqual(feed.excluded, ['a']);
  assert.deepEqual(applyFeedChange(feed, { action: 'reset' }, published), DEFAULT_FEED);
});

test('malformed feed changes are rejected', () => {
  assert.equal(readFeedChange(null), null);
  assert.equal(readFeedChange({ action: 'exclude', ids: [] }), null);
  assert.equal(readFeedChange({ action: 'exclude', ids: [{ id: 1 }] }), null);
  assert.equal(readFeedChange({ action: 'settings', autoIncludeNew: 'yes' }), null);
  assert.equal(readFeedChange({ action: 'drop-table' }), null);
  assert.deepEqual(readFeedChange({ action: 'include', ids: [7, '7', 'x'] }), { action: 'include', ids: ['7', 'x'] });
});

const listing = (over: Record<string, any> = {}) => ({
  id: 'p1',
  ref: 'E08-100',
  slug: 'marina-2br',
  title: 'Marina 2BR',
  status: 'published',
  purpose: 'sale',
  type: 'Apartment',
  completion: 'ready',
  emirate: 'Dubai',
  area: 'Dubai Marina',
  price: 2_000_000,
  beds: 2,
  baths: 2,
  size: 1200,
  photos: [{ src: '/images/property-images/marina-night.webp', caption: 'Night view' }],
  highlights: ['Sea view'],
  broker: { name: 'Sara Ali', type: 'broker', slug: 'sara-ali', phone: '+971500000000', email: 'sara@example.com', agencyName: '' },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
  ...over,
});

test('feed properties expose public fields with absolute URLs', () => {
  const p = toFeedProperty(listing({ contactOverride: { phone: '+971511111111' } }));
  assert.equal(p.id, 'p1');
  assert.equal(p.reference, 'E08-100');
  assert.match(p.url, /^https?:\/\/.+\/property\/marina-2br$/);
  assert.deepEqual(p.price, { amount: 2_000_000, currency: 'AED', onRequest: false, frequency: null, previousAmount: null });
  assert.match(p.images[0].url, /^https?:\/\/.+\/api\/media-assets\/property-images\/marina-night\.webp$/);
  assert.equal(p.images[0].caption, 'Night view');
  assert.equal(p.contact.name, 'Sara Ali');
  assert.match(p.contact.profileUrl, /\/brokers\/sara-ali$/);
  assert.deepEqual(p.size, { value: 1200, unit: 'sqft' });
  assert.equal('ownerMemberId' in p, false);
});

test('price on request hides the amount', () => {
  const p = toFeedProperty(listing({ priceOnRequest: true, price: undefined }));
  assert.equal(p.price.amount, null);
  assert.equal(p.price.onRequest, true);
});

const catalogue = [
  toFeedProperty(listing()),
  toFeedProperty(listing({ id: 'p2', ref: 'E08-200', slug: 'hills-villa', title: 'Hills Villa', type: 'Villa', area: 'Dubai Hills Estate', price: 9_000_000, beds: 5, createdAt: '2026-11-05T00:00:00.000Z', updatedAt: '2026-11-06T00:00:00.000Z' })),
  toFeedProperty(listing({ id: 'p3', ref: 'E08-300', slug: 'jlt-studio', title: 'JLT Studio', purpose: 'rent', rent: { frequency: 'yearly' }, area: 'JLT', price: 65_000, beds: 0, createdAt: '2026-11-10T00:00:00.000Z', updatedAt: '2026-11-25T00:00:00.000Z' })),
];
const query = (qs: string) => readFeedQuery(new URLSearchParams(qs));

test('feed query filters, sorts and paginates', () => {
  assert.deepEqual(queryFeed(catalogue, query('')).data.map((p) => p.id), ['p3', 'p2', 'p1']);
  assert.deepEqual(queryFeed(catalogue, query('purpose=sale&sort=price_desc')).data.map((p) => p.id), ['p2', 'p1']);
  assert.deepEqual(queryFeed(catalogue, query('type=villa,apartment&minBeds=3')).data.map((p) => p.id), ['p2']);
  assert.deepEqual(queryFeed(catalogue, query('area=marina')).data.map((p) => p.id), ['p1']);
  assert.deepEqual(queryFeed(catalogue, query('maxBeds=0')).data.map((p) => p.id), ['p3']);
  assert.deepEqual(queryFeed(catalogue, query('updatedSince=2026-11-15')).data.map((p) => p.id), ['p3', 'p1']);
  assert.deepEqual(queryFeed(catalogue, query('ids=E08-200,p1&sort=price_asc')).data.map((p) => p.id), ['p1', 'p2']);
  const page = queryFeed(catalogue, query('limit=2&page=2'));
  assert.deepEqual(page.data.map((p) => p.id), ['p1']);
  assert.deepEqual(page.meta, { total: 3, page: 2, limit: 2, pages: 2 });
});

test('invalid query parameters are reported', () => {
  const q = query('purpose=buy&limit=500&minPrice=-1&sort=random&updatedSince=yesterday');
  assert.equal(q.errors.length, 5);
});

test('a single property is found by ID, reference or slug', () => {
  assert.equal(findFeedProperty(catalogue, 'p2')?.id, 'p2');
  assert.equal(findFeedProperty(catalogue, 'E08-300')?.id, 'p3');
  assert.equal(findFeedProperty(catalogue, 'marina-2br')?.id, 'p1');
  assert.equal(findFeedProperty(catalogue, 'nope'), null);
});

test('independent brokers and agency admins can use the feed; team brokers, developers and buyers cannot', () => {
  assert.equal(canUseFeedAccount('broker', undefined), true);
  assert.equal(canUseFeedAccount('agency', 'agency_admin'), true);
  assert.equal(canUseFeedAccount('agency', undefined), true);
  assert.equal(canUseFeedAccount('agency', 'agency_broker'), false);
  assert.equal(canUseFeedAccount('developer', undefined), false);
  assert.equal(canUseFeedAccount('owner', undefined), false);
  assert.equal(canUseFeedAccount('buyer', undefined), false);
});

test('agency listings name the agency; team-broker listings name the broker and their agency', () => {
  const agency = toFeedProperty(listing({ broker: { name: 'GoodLife Real Estate', type: 'agency', agencyRole: 'agency_admin', slug: 'goodlife' } }));
  assert.equal(agency.contact.kind, 'agency');
  assert.equal(agency.contact.agency, 'GoodLife Real Estate');
  const team = toFeedProperty(listing({ broker: { name: 'Omar Haddad', type: 'agency', agencyRole: 'agency_broker', currentAgency: { name: 'GoodLife Real Estate' }, slug: 'omar' } }));
  assert.equal(team.contact.kind, 'broker');
  assert.equal(team.contact.name, 'Omar Haddad');
  assert.equal(team.contact.agency, 'GoodLife Real Estate');
});

test('feed properties list all of the property brokers (up to five, no primary)', () => {
  const profiles = [
    { name: 'Omar Haddad', type: 'agency', agencyRole: 'agency_broker', currentAgency: { name: 'GoodLife' }, slug: 'omar', phone: '+971 50 1' },
    { name: 'Sara Ali', type: 'broker', slug: 'sara-ali', brnNumber: '12345' },
  ];
  const p = toFeedProperty(listing({ brokerProfiles: profiles }));
  assert.equal(p.brokers.length, 2);
  assert.deepEqual(p.brokers.map((b) => b.name), ['Omar Haddad', 'Sara Ali']);
  assert.equal(p.brokers[0].agency, 'GoodLife');
  assert.equal(p.brokers[1].brn, '12345');
  assert.match(p.brokers[1].profileUrl, /\/brokers\/sara-ali$/);
  assert.deepEqual(toFeedProperty(listing()).brokers, []);
});

test('the feed never exposes broker phone, WhatsApp or email, so leads come through Emirate08', () => {
  const p = toFeedProperty(
    listing({
      contactOverride: { phone: '+971511111111', whatsapp: '+971511111111', email: 'direct@example.com' },
      brokerProfiles: [{ name: 'Sara Ali', slug: 'sara-ali', phone: '+971500000000', whatsapp: '+971500000000', email: 'sara@example.com' }],
    }),
  );
  const json = JSON.stringify(p);
  for (const leak of ['+971511111111', '+971500000000', 'direct@example.com', 'sara@example.com']) assert.equal(json.includes(leak), false, leak);
  for (const key of ['phone', 'whatsapp', 'email']) {
    assert.equal(key in p.contact, false);
    assert.equal(key in p.brokers[0], false);
  }
});

test('feed properties carry a signed, embeddable enquiry form for the feed', () => {
  assert.equal(toFeedProperty(listing()).enquiry, null);
  const p = toFeedProperty(listing({ title: 'Marina "2BR" <view>' }), { feedId: 7, sign: (id) => 'sig-' + id });
  const url = new URL(p.enquiry.embedUrl);
  assert.equal(url.pathname, EMBED_ENQUIRY_PATH + 'p1');
  assert.equal(url.searchParams.get('f'), '7');
  assert.equal(url.searchParams.get('t'), 'sig-p1');
  assert.match(p.enquiry.embedHtml, /^<iframe src="https?:\/\/[^"]+\/embed\/enquiry\/p1\?f=7&amp;t=sig-p1"/);
  assert.match(p.enquiry.embedHtml, /title="Enquire about Marina &quot;2BR&quot; &lt;view>"/);
});

test('feed brokers carry an id and slug, and the broker filter matches either', () => {
  const props = [
    toFeedProperty(listing({ id: 'a1', brokerProfiles: [{ id: 41, name: 'Omar', slug: 'omar' }] })),
    toFeedProperty(listing({ id: 'a2', brokerProfiles: [{ id: 42, name: 'Lina', slug: 'lina' }] })),
  ];
  assert.deepEqual([props[0].brokers[0].id, props[0].brokers[0].slug], ['41', 'omar']);
  const byId = queryFeed(props, readFeedQuery(new URLSearchParams('broker=42')));
  assert.deepEqual(byId.data.map((p) => p.id), ['a2']);
  const bySlug = queryFeed(props, readFeedQuery(new URLSearchParams('broker=omar')));
  assert.deepEqual(bySlug.data.map((p) => p.id), ['a1']);
});

test('team members expose public profile fields only, with their role and assigned count', () => {
  const member = toFeedTeamMember(
    {
      id: 41, slug: 'omar', name: 'Omar Haddad', agencyRole: 'agency_broker', title: 'Senior broker', photo: '/images/omar.webp',
      areas: ['Dubai Marina'], languages: ['English', 'Arabic'], brnNumber: '12345', brnVerified: true,
      phone: '+971500000000', whatsapp: '+971500000000', email: 'omar@example.com',
    },
    3,
  );
  assert.equal(member.id, '41');
  assert.equal(member.role, 'broker');
  assert.equal(member.assignedProperties, 3);
  assert.match(member.profileUrl, /\/brokers\/omar$/);
  assert.match(member.photo, /^https?:\/\//);
  for (const key of ['phone', 'whatsapp', 'email']) assert.equal(key in member, false);
  assert.equal(toFeedTeamMember({ id: 7, name: 'M', agencyRole: 'agency_manager' }, 0).role, 'manager');
  const team = [{ member, properties: [] }];
  assert.equal(findTeamMember(team, 'omar'), team[0]);
  assert.equal(findTeamMember(team, '41'), team[0]);
  assert.equal(findTeamMember(team, 'nobody'), null);
});
