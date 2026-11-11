import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Members } from '../src/collections/Members';

const hook = Members.hooks!.beforeChange![0];
const snapshot = { plan: 'broker-bronze', name: 'Bronze', price: 50, currency: 'AED', interval: 'month' };
function run(data: any, originalDoc: any = undefined, operation = 'create') {
  return (hook as any)({ data, originalDoc, operation, req: { payload: { find: async () => ({ docs: [{ name: 'Bronze', price: 100 }] }) } } });
}
test('new members receive the current server price, ignoring supplied snapshots', async () => {
  const member = await run({ accountType: 'broker', plan: 'broker-bronze', membership: { price: 1 } });
  assert.equal(member.membership.price, 100);
});
test('existing members retain their price after catalogue changes and profile updates', async () => {
  const member = await run({ name: 'Updated', membership: { price: 1 } }, { accountType: 'broker', plan: 'broker-bronze', membership: snapshot }, 'update');
  assert.deepEqual(member.membership, snapshot);
});
test('intentional plan changes receive current pricing', async () => {
  const member = await run({ plan: 'broker-silver' }, { accountType: 'broker', plan: 'broker-bronze', membership: snapshot }, 'update');
  assert.equal(member.membership.price, 100);
  assert.equal(member.membership.plan, 'broker-silver');
});
test('packages for another user type cannot be assigned', async () => {
  const member = await run({ accountType: 'agency', plan: 'broker-gold' });
  assert.equal(member.plan, 'agency-bronze');
});
