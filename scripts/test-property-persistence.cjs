const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const assert = require('node:assert/strict');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(
    this,
    request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request,
    ...args,
  );
};
require.extensions['.ts'] = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
const { syncMemberProperties, listingFromProperty } = require('../src/lib/server/member-properties.ts');
const storage = require('../src/lib/storage.ts');

function database(initial = []) {
  const docs = structuredClone(initial);
  return {
    docs,
    async find() {
      return { docs: structuredClone(docs) };
    },
    async create({ data }) {
      assert.ok(data.slug, 'slug is required');
      assert.equal(
        docs.some((doc) => doc.slug === data.slug),
        false,
        'global slug must be unique',
      );
      const doc = { ...structuredClone(data), id: docs.length + 100 };
      docs.push(doc);
      return doc;
    },
    async update({ id, data }) {
      assert.equal(
        docs.some((doc) => doc.id !== id && doc.slug === data.slug),
        false,
        'global slug must be unique',
      );
      const i = docs.findIndex((doc) => doc.id === id);
      docs[i] = { ...docs[i], ...structuredClone(data) };
      return docs[i];
    },
    async delete({ id }) {
      const i = docs.findIndex((doc) => doc.id === id);
      docs.splice(i, 1);
    },
  };
}
const draft = (id, title = '') => ({
  id,
  title,
  slug: title ? 'same-title' : id,
  status: 'draft',
  photos: [],
  amenities: [],
  highlights: [],
  media: {},
  display: {},
});

test('early untitled drafts and repeated titles across accounts receive stable unique server slugs', async () => {
  const db = database();
  const a = draft('shared-demo-id');
  await syncMemberProperties(db, 1, { listings: [a] });
  await syncMemberProperties(db, 2, { listings: [a] });
  assert.equal(new Set(db.docs.map((doc) => doc.slug)).size, 2);
  const oldSlug = db.docs[0].slug;
  await syncMemberProperties(db, 1, { listings: [a] });
  assert.equal(db.docs.length, 2);
  assert.equal(db.docs[0].slug, oldSlug);
  const state = { listings: [draft('one', 'Same title'), draft('two', 'Same title')] };
  const result = await syncMemberProperties(db, 3, state);
  assert.notEqual(result[0].slug, result[1].slug);
  for (const item of result) assert.equal(db.docs.find((doc) => doc.appData.id === item.id).appData.slug, item.slug);
});

test('published URL remains stable when the listing title changes', async () => {
  const l = { ...draft('listing-a', 'Old title'), status: 'published', slugLocked: true };
  const db = database([{ ...l, id: 8, slug: 'existing-public-url', appData: { ...l, ownerMemberId: 4 } }]);
  const saved = await syncMemberProperties(db, 4, {
    listings: [{ ...l, title: 'A different title', slug: 'client-stale-url' }],
  });
  assert.equal(saved[0].slug, 'existing-public-url');
});

test('uploaded media IDs are mirrored into canonical gallery and survive reload over stale images', async () => {
  const photo = {
    src: 'https://example.com/new.jpg',
    mediaId: 99,
    caption: 'New photo',
    hash: 'original-hash',
    focalX: 25,
  };
  const l = { ...draft('photo-draft', 'Same title'), photos: [photo], featured: photo.src };
  const db = database();
  await syncMemberProperties(db, 7, { listings: [l] });
  assert.equal(db.docs[0].featuredImage, 99);
  assert.deepEqual(db.docs[0].photos, [{ image: 99, caption: 'New photo' }]);
  const restored = listingFromProperty({
    ...db.docs[0],
    featuredImage: { url: 'https://example.com/old.jpg' },
    photos: [{ image: { url: 'https://example.com/old.jpg' } }],
  });
  assert.deepEqual(restored.photos, [photo]);
  assert.equal(restored.featured, photo.src);
  assert.deepEqual(restored.images, [photo.src]);
  db.docs[0].appData.photos = [];
  assert.deepEqual(listingFromProperty(db.docs[0]).images, []);
});

test('source-only photos stay available without inventing a media relationship', async () => {
  const db = database();
  const l = {
    ...draft('legacy-photo'),
    photos: [{ src: '/images/legacy.jpg', caption: 'Legacy' }],
    featured: '/images/legacy.jpg',
  };
  await syncMemberProperties(db, 5, { listings: [l] });
  assert.deepEqual(db.docs[0].photos, []);
  assert.equal(db.docs[0].featuredImage, null);
  assert.equal(listingFromProperty(db.docs[0]).photos[0].src, '/images/legacy.jpg');
});

test('failed persistence is reported, keeps photos in memory, and blocks a destructive refresh until retry succeeds', async () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  console.error = () => {};
  const key = 'data:12';
  const state = { listings: [{ ...draft('keep-me'), photos: [{ src: 'https://example.com/keep.jpg' }] }] };
  try {
    storage.hydrate({ [key]: state });
    global.fetch = async () =>
      new Response(JSON.stringify({ error: 'The following field is invalid: slug' }), { status: 500 });
    storage.write(key, state);
    await assert.rejects(storage.flushWrites(key), /invalid: slug/);
    assert.equal(storage.read(key, null).listings[0].photos[0].src, 'https://example.com/keep.jpg');
    await assert.rejects(storage.flushWrites(), /invalid: slug/);
    global.fetch = async () =>
      new Response(JSON.stringify({ ok: true, listings: [{ id: 'keep-me', slug: 'server-canonical-url' }] }), {
        status: 200,
      });
    storage.write(key, state);
    await storage.flushWrites(key);
    assert.equal(storage.read(key, null).listings[0].slug, 'server-canonical-url');
    assert.equal(storage.read(key, null).listings[0].photos.length, 1);
    await storage.flushWrites();
  } finally {
    storage.setAuthenticated(false);
    global.fetch = originalFetch;
    console.error = originalError;
  }
});

test('saving waits for the server response before reporting success', async () => {
  const originalFetch = global.fetch;
  let respond;
  let started;
  const requestStarted = new Promise((resolve) => {
    started = resolve;
  });
  try {
    const key = 'data:13';
    storage.hydrate({ [key]: { listings: [] } });
    global.fetch = () => {
      started();
      return new Promise((resolve) => {
        respond = resolve;
      });
    };
    storage.write(key, { listings: [] });
    let completed = false;
    const save = storage.flushWrites(key).then(() => {
      completed = true;
    });
    await requestStarted;
    assert.equal(completed, false);
    respond(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await save;
    assert.equal(completed, true);
  } finally {
    storage.setAuthenticated(false);
    global.fetch = originalFetch;
  }
});
