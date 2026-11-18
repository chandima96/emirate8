import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROFILE_AI_FIELDS, PROFILE_FREE_TEXT_KEYS, PROFILE_LIST_KEYS, profileAiOutputSchema, rowsToProfile } from '../src/lib/profileAutofill';
import { dropUnsupported } from '../src/lib/aiEvidence';

test('every profile field carries its own hint, and list keys are real fields', () => {
  const keys = PROFILE_AI_FIELDS.map((field) => field.key);
  for (const field of PROFILE_AI_FIELDS) assert.ok(field.hint, `hint for ${field.key}`);
  for (const key of [...PROFILE_LIST_KEYS, ...PROFILE_FREE_TEXT_KEYS]) assert.ok(keys.includes(key), key);
  assert.equal(new Set(keys).size, keys.length);
});

test('profile output schema accepts only known keys and the supplied labels, with closed objects', () => {
  const schema: any = profileAiOutputSchema(['Pasted text', 'Website · example.com']);
  const source = schema.properties.sources.items;
  assert.deepEqual(source.properties.label.enum, ['Pasted text', 'Website · example.com']);
  assert.ok(source.properties.fields.items.properties.key.enum.includes('experienceEntries'));
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
    }
    Object.values(node).forEach(walk);
  };
  walk(schema);
});

test('profile rows join into lists and unsupported answers are dropped item by item', () => {
  const page = 'Sara Haddad — Senior Property Consultant at Example Realty. Speaks English and Arabic. '
    + 'In real estate since 2014. Covers Dubai Marina and JLT. instagram.com/sara.realty\n'
    + 'Sara has helped hundreds of families find their home in Dubai.';
  const { suggestions, evidence } = rowsToProfile([
    { key: 'title', value: 'Senior Property Consultant', evidence: 'Senior Property Consultant' },
    { key: 'title', value: 'Ignored', evidence: 'x' }, // first answer wins
    { key: 'experience', value: '12', evidence: 'since 2014' },
    { key: 'languages', value: 'English', evidence: 'English' },
    { key: 'languages', value: 'Arabic', evidence: 'Arabic' },
    { key: 'languages', value: 'French', evidence: 'French' }, // not in the source
    { key: 'languages', value: 'english', evidence: 'English' }, // duplicate
    { key: 'areas', value: 'Dubai Marina', evidence: 'Dubai Marina' },
    { key: 'socials', value: { platform: 'Instagram', url: 'https://instagram.com/sara.realty' }, evidence: 'instagram.com/sara.realty' },
    { key: 'achievements', value: { kind: 'Professional award', title: 'Top Agent 2023', detail: '', date: '' }, evidence: 'Top Agent 2023' }, // invented
    { key: 'brn', value: '12345', evidence: 'BRN 12345' }, // invented
    { key: 'bio', value: 'Sara has helped hundreds of families.', evidence: 'something paraphrased' }, // free text: not checked
  ]);
  assert.equal(suggestions.title, 'Senior Property Consultant');
  assert.deepEqual(suggestions.languages, ['English', 'Arabic', 'French']);
  const removed = dropUnsupported(suggestions, evidence, page, { skip: PROFILE_FREE_TEXT_KEYS });
  assert.deepEqual(removed.map((entry) => entry.split(':{')[0]).sort(), ['achievements', 'brn', 'languages:French']);
  assert.deepEqual(suggestions.languages, ['English', 'Arabic']);
  assert.ok(suggestions.socials && suggestions.bio && suggestions.experience);
  assert.equal(suggestions.achievements, undefined);
});
