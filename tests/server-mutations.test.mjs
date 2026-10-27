import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as payloadCookies from 'payload/shared';

// Run the real services with a fake Payload boundary: no production database writes.
function services(payload, config = {}) {
  const loaded = new Map();
  function load(name) {
    if (loaded.has(name)) return loaded.get(name);
    const filename = path.resolve('src/lib/server', name + '.ts');
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const exports = {};
    const require = (id) => {
      if (id === 'server-only') return {};
      if (id === 'payload') return { getPayload: async () => payload };
      if (id === 'payload/shared') return payloadCookies;
      if (id === '@payload-config') return { __esModule: true, default: Promise.resolve(config) };
      if (id.startsWith('./')) return load(id.slice(2));
      throw new Error('Unexpected service dependency: ' + id);
    };
    vm.runInNewContext(outputText, { exports, require, console }, { filename });
    loaded.set(name, exports);
    return exports;
  }
  return load;
}

test('anonymous callers cannot change accounts, delete accounts, or update enquiries', async () => {
  const load = services({ auth: async () => ({ user: null }) });
  const headers = new Headers();
  for (const response of await Promise.all([
    load('session').updateSession({ name: 'Another Person' }, headers),
    load('session').deleteAccount({ password: 'anything' }, headers),
    load('enquiries').updateEnquiryStatus({ id: '1', status: 'closed' }, headers),
  ]))
    assert.equal(response.status, 401);
});

test('enquiry status writes are restricted to the authenticated recipient', async () => {
  let update;
  const load = services({
    auth: async () => ({ user: { id: 42, collection: 'members' } }),
    update: async (options) => {
      update = options;
      return { docs: [] };
    },
  });
  const response = await load('enquiries').updateEnquiryStatus({ id: '99', status: 'closed' }, new Headers());
  assert.equal(update.where.and[0].id.equals, '99');
  assert.equal(update.where.and[1].brokerMember.equals, 42);
  assert.equal(response.data.updated, false);
});

test('account updates use the session identity instead of a supplied member ID', async () => {
  let update;
  const load = services({
    auth: async () => ({ user: { id: 42, collection: 'members' } }),
    findByID: async () => ({ profile: { privacy: { showPhone: false } } }),
    update: async (options) => {
      update = options;
      return { id: 42, name: options.data.name, profile: options.data.profile };
    },
  });
  const response = await load('session').updateSession({ id: 99, name: 'Updated Name' }, new Headers());
  assert.equal(update.id, 42);
  assert.equal(response.data.user.id, 42);
  assert.equal(update.data.profile.privacy.showPhone, false);
});

test('account deletion requires the correct password before any records are deleted', async () => {
  const load = services({
    auth: async () => ({ user: { id: 42, collection: 'members' } }),
    findByID: async () => ({ email: 'member@example.com' }),
    login: async () => {
      throw new Error('Wrong password');
    },
    delete: async () => {
      assert.fail('Must not delete records');
    },
  });
  const response = await load('session').deleteAccount({ password: 'wrong' }, new Headers());
  assert.equal(response.status, 401);
});

test('invalid public submissions fail validation before creating records', async () => {
  const load = services({
    create: async () => {
      assert.fail('Must not create records');
    },
  });
  assert.equal((await load('waitlist').joinWaitlist({ email: 'invalid' })).status, 400);
  assert.equal((await load('waitlist').joinWaitlist(null)).status, 400);
  assert.equal((await load('enquiries').createEnquiry({ name: 'Test' }, new Headers())).status, 400);
});

test('login creates an HTTP-only cookie and excludes its token from the action result', async () => {
  const load = services(
    {
      find: async () => ({ docs: [{ email: 'member@example.com' }] }),
      login: async () => ({
        token: 'private-test-token',
        user: { id: 42, name: 'Member', email: 'member@example.com' },
      }),
    },
    {
      cookiePrefix: 'payload',
      collections: [{ slug: 'members', auth: { cookies: { sameSite: 'Lax', secure: true }, tokenExpiration: 7200 } }],
    },
  );
  const response = await load('auth').authenticate(
    { action: 'login', email: 'member@example.com', password: 'test' },
    new Headers(),
  );
  assert.equal(response.cookie.name, 'payload-token');
  assert.equal(response.cookie.httpOnly, true);
  assert.equal(response.cookie.secure, true);
  assert.equal(response.cookie.value, 'private-test-token');
  const clientResult = load('result').actionResult(response);
  assert.equal(clientResult.ok, true);
  assert.equal(clientResult.user.id, 42);
  assert.equal(JSON.stringify(clientResult).includes('private-test-token'), false);
});

test('logout expires the Payload session cookie', async () => {
  const load = services(
    {},
    {
      cookiePrefix: 'payload',
      collections: [{ slug: 'members', auth: { cookies: { sameSite: 'Lax' }, tokenExpiration: 7200 } }],
    },
  );
  const response = await load('auth').authenticate({ action: 'logout' }, new Headers());
  assert.equal(response.cookie.name, 'payload-token');
  assert.ok(new Date(response.cookie.expires).getTime() < Date.now());
  assert.equal(response.cookie.value, undefined);
});
