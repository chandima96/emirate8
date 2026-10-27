import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('../src/lib/store.ts', import.meta.url), 'utf8');
const slugFunction = source.slice(source.indexOf('export function uniqueSlug('), source.indexOf('export async function resetDemo(')).replace('export ', '');

function suggest(base, selfId, publicBrokers, accounts = []) {
  const context = { brokers: () => publicBrokers, users: () => accounts };
  vm.runInNewContext(slugFunction, context);
  return context.uniqueSlug(base, selfId);
}

test('publishing profile edits keeps the owner URL across public and account records', () => {
  const slug = 'sanjana-fernando-2';
  assert.equal(suggest(slug, '42', [{ id: 42, userId: 42, slug }], [{ id: 42, portfolio: { slug } }]), slug);
  assert.equal(suggest(slug, 42, [{ id: '42', slug }]), slug);
});

test('URLs belonging to other brokers still require a unique suffix', () => {
  const slug = 'sanjana-fernando';
  assert.equal(suggest(slug, 42, [{ id: 7, slug }, { id: 8, slug: slug + '-2' }]), slug + '-3');
  assert.equal(suggest(slug, 42, [], [{ id: 7, portfolio: { slug } }]), slug + '-2');
  assert.equal(suggest(slug, undefined, [{ id: 42, slug }]), slug + '-2');
});
