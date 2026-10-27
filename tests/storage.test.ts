import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appStore, cache, flushWrites, hydrate, read, setAuthenticated, write } from '../src/lib/storage';

test('Zustand hydration replaces stale records and sign-out clears private state', () => {
  cache('old-account', { listings: ['stale'] });
  hydrate({ 'data:2': { listings: ['fresh'] } });
  assert.equal(read('old-account', null), null);
  assert.deepEqual(appStore.getState().records['data:2'], { listings: ['fresh'] });
  setAuthenticated(false);
  assert.deepEqual(appStore.getState().records, {});
});

test('queued saves keep only the latest snapshot and flush before refresh', async () => {
  const originalFetch = globalThis.fetch;
  const requests: any[] = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ ok: true }));
  };
  try {
    hydrate({});
    write('data:2', { listings: [{ id: 'old' }] });
    write('data:2', { listings: [{ id: 'latest' }] });
    await flushWrites();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].value.listings[0].id, 'latest');
    write('data:2', { listings: [] });
    setAuthenticated(false);
    await flushWrites();
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthenticated(false);
  }
});
