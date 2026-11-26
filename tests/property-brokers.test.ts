import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PROPERTY_BROKERS, brokerIdsOf } from '../src/lib/propertyBrokers';
import { propertyData, listingFromProperty } from '../src/lib/server/member-properties';

test('a property has up to five brokers, de-duplicated, as string IDs', () => {
  assert.equal(MAX_PROPERTY_BROKERS, 5);
  assert.deepEqual(brokerIdsOf({ brokers: [3, '3', { id: 4 }, 5] }), ['3', '4', '5']);
  assert.deepEqual(brokerIdsOf({ brokers: [1, 2, 3, 4, 5, 6, 7] }), ['1', '2', '3', '4', '5']);
  assert.deepEqual(brokerIdsOf({ brokers: [] }), []);
  assert.deepEqual(brokerIdsOf(null), []);
});

test('older data with a single primary broker becomes a one-broker list', () => {
  assert.deepEqual(brokerIdsOf({ primaryBroker: '9' }), ['9']);
  assert.deepEqual(brokerIdsOf({ broker: 9 }), ['9']);
  // A populated `broker` display object is not a brokers-row reference (its id can be a member ID).
  assert.deepEqual(brokerIdsOf({ broker: { id: 42, name: 'Profile' } }), []);
  // The new list wins over the retired fields.
  assert.deepEqual(brokerIdsOf({ brokers: ['1'], primaryBroker: '9' }), ['1']);
});

test('saving a listing writes the broker list and drops the primary broker field', () => {
  const data: any = propertyData({ id: 'l1', title: 'T', primaryBroker: '7', brokers: ['7', '8'] }, 2);
  assert.deepEqual(data.brokers, [7, 8]);
  assert.equal('primaryBroker' in data, false);
  assert.equal('broker' in data, false);
  assert.equal('primaryBroker' in data.appData, false);
  assert.deepEqual(data.appData.brokers, ['7', '8']);
});

test('loading a property reads its brokers from the relationship', () => {
  const listing: any = listingFromProperty({ id: 1, brokers: [{ id: 7 }, { id: 8 }], appData: { id: 'l1', brokers: ['1'], primaryBroker: '1' } });
  assert.deepEqual(listing.brokers, ['7', '8']);
  assert.equal('primaryBroker' in listing, false);
});
