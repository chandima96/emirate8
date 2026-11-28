import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
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
      if (id === 'node:crypto') return crypto;
      if (id === '@/config/plans') return load('../../config/plans');
      if (id === '@/lib/payloadCacheHooks') return { invalidateCmsCache: async () => {} };
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

test('workspace and session member context rejects suspended members and other collections', async () => {
  const headers = new Headers();
  const suspended = services({
    auth: async () => ({ user: { id: 42, collection: 'members' } }),
    findByID: async () => ({ id: 42, isSuspended: true }),
  });
  const staff = services({ auth: async () => ({ user: { id: 42, collection: 'users' } }) });
  for (const load of [suspended, staff]) {
    assert.equal(await load('memberContext').getMemberContext(headers), null);
    assert.equal((await load('session').getSession(headers)).data.user, null);
  }
});

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
    find: async () => ({ docs: [] }),
    create: async ({ data }) => ({ id: 1, ...data }),
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

function enquiryPayload(members, created) {
  return {
    auth: async () => ({ user: null }),
    find: async ({ collection, where }) => {
      if (collection === 'members') return { docs: members.filter((m) => String(m.id) === String(where.id.equals)) };
      if (collection === 'properties' && where.or[0]['appData.id'].equals === 'agency-listing') return { docs: [{ ownerAgency: 7 }] };
      if (collection === 'agencies') return { docs: String(where.id.equals) === '7' ? [{ id: 7, name: 'Elite Realty' }] : [] };
      return { docs: [] };
    },
    create: async ({ data }) => {
      created.data = data;
      return { id: 1, ...data };
    },
  };
}
const enquiryBody = { name: 'Buyer', email: 'b@example.com', message: 'Is this still available?' };

test('enquiries to an independent broker go to that broker only', async () => {
  const created = {};
  const load = services(enquiryPayload([{ id: 5, profile: {} }], created));
  const response = await load('enquiries').createEnquiry({ ...enquiryBody, brokerId: 5 }, new Headers());
  assert.equal(response.status, 201);
  assert.equal(created.data.brokerMember, 5);
  assert.equal(created.data.agency, undefined);
  assert.equal(created.data.agencyName, '');
});

test('only enquiries about an agency-owned listing also reach the agency inbox', async () => {
  const created = {};
  const members = [{ id: 6, profile: { agency: { agencyId: 7, agencyRole: 'agency_broker' } } }];
  const load = services(enquiryPayload(members, created));
  await load('enquiries').createEnquiry({ ...enquiryBody, brokerId: '6' }, new Headers());
  assert.equal(created.data.agency, undefined);
  await load('enquiries').createEnquiry({ ...enquiryBody, brokerId: '6', propertyId: 'agency-listing' }, new Headers());
  assert.equal(created.data.brokerMember, 6);
  assert.equal(created.data.agency, 7);
  assert.equal(created.data.agencyName, 'Elite Realty');
});

test('agency admins read agency enquiries; agency brokers only read their own', async () => {
  const queries = [];
  const forUser = (user) =>
    services({
      auth: async () => ({ user: { collection: 'members', ...user } }),
      find: async (options) => {
        queries.push(options.where.or);
        return { docs: [{ id: 3, brokerMember: { id: 6, name: 'Sara', email: 's@x.com' }, agency: 7, agencyName: 'Elite Realty' }] };
      },
    });
  const admin = await forUser({ id: 9, profile: { agency: { agencyId: 7, agencyRole: 'agency_admin' } } })('enquiries').getEnquiries(new Headers());
  assert.equal(JSON.stringify(queries[0][2]), JSON.stringify({ agency: { equals: '7' } }));
  assert.equal(admin.data.enquiries[0].scope, 'agency');
  assert.equal(admin.data.enquiries[0].brokerName, 'Sara');
  assert.equal(admin.data.enquiries[0].brokerEmail, 's@x.com');

  const broker = await forUser({ id: 6, profile: { agency: { agencyId: 7, agencyRole: 'agency_broker' } } })('enquiries').getEnquiries(new Headers());
  assert.equal(queries[1].length, 2);
  assert.equal(broker.data.enquiries[0].scope, 'direct');
  assert.equal(broker.data.enquiries[0].agencyName, 'Elite Realty');
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
