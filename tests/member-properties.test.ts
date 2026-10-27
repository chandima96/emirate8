import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listingFromProperty, syncMemberProperties } from '../src/lib/server/member-properties';

test('CMS fields override stale workspace JSON while retaining listing identity', () => {
  const listing = listingFromProperty({
    id: 4,
    title: 'Updated title',
    status: 'rented',
    price: 4500,
    highlights: [{ highlight: 'Updated highlight' }],
    appData: { id: 'listing-4', ownerMemberId: 2, title: 'Old title', status: 'published', price: 1000 },
  });
  assert.equal(listing.id, 'listing-4');
  assert.equal(listing.ownerMemberId, 2);
  assert.equal(listing.title, 'Updated title');
  assert.equal(listing.status, 'rented');
  assert.equal(listing.price, 4500);
  assert.deepEqual(listing.highlights, ['Updated highlight']);
});

test('workspace saves update, create and remove only the authenticated member’s properties', async () => {
  const updated: any[] = [];
  const created: any[] = [];
  const removed: any[] = [];
  const payload = {
    find: async () => ({
      docs: [
        { id: 1, appData: { id: 'keep', ownerMemberId: 2 } },
        { id: 2, appData: { id: 'remove', ownerMemberId: 2 } },
        { id: 3, appData: { id: 'other', ownerMemberId: 3 } },
      ],
    }),
    update: async (args: any) => updated.push(args),
    create: async (args: any) => created.push(args),
    delete: async (args: any) => removed.push(args),
  };
  await syncMemberProperties(payload as any, 2, {
    listings: [
      { id: 'keep', title: 'Latest' },
      { id: 'new', title: 'New' },
    ],
  });
  assert.deepEqual(
    updated.map((item) => item.id),
    [1],
  );
  assert.equal(created[0].data.appData.ownerMemberId, 2);
  assert.deepEqual(
    removed.map((item) => item.id),
    [2],
  );
  await assert.rejects(syncMemberProperties(payload as any, 2, {}), /must be an array/);
});
