import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceFeedback, evidenceProblems, linkAllowed, urlsIn, type AgentInput } from '../src/lib/listingAgent';
import { listingAiOutputSchema } from '../src/lib/listingAutofill';

const page: AgentInput = {
  label: 'Website - example.com',
  page: true,
  blocks: [],
  text: 'Marina Gate 1, Dubai Marina. Price AED 2,450,000. Amenities: Pool, Gym. Brochure: https://dev.example.ae/marina-gate/brochure.pdf. See https://dev.example.ae/project.',
};
const pdf: AgentInput = { label: 'brochure.pdf', page: false, blocks: [], text: null };

test('links: only exact URLs written in a text source', () => {
  assert.deepEqual([...urlsIn([page.text])], ['https://dev.example.ae/marina-gate/brochure.pdf', 'https://dev.example.ae/project']);
  assert.equal(linkAllowed('https://dev.example.ae/project', [page, pdf]), true);
  // A built URL (e.g. carrying private data in the query string) is refused.
  assert.equal(linkAllowed('https://dev.example.ae/project?unit=1203', [page, pdf]), false);
  assert.equal(linkAllowed('https://evil.example.com/', [page, pdf]), false);
  assert.equal(linkAllowed('javascript:alert(1)', [page]), false);
});

test('evidence problems name the answers the route would drop, with their quotes', () => {
  const parsed = {
    sources: [
      {
        label: page.label,
        fields: [
          { key: 'askingPrice', value: '2450000', evidence: 'AED 2,450,000' },
          { key: 'buildingName', value: 'Marina Gate 1', evidence: 'Marina Gate One' },
          { key: 'amenities', value: 'sh_pool', evidence: 'Pool' },
          { key: 'amenities', value: 'sauna', evidence: 'Sauna' },
        ],
        conflicts: [],
      },
      // PDFs have no server-side text, so they are not checked.
      { label: pdf.label, fields: [{ key: 'bedrooms', value: '2', evidence: 'anything' }], conflicts: [] },
    ],
  };
  const problems = evidenceProblems(parsed, [page, pdf]);
  assert.deepEqual(problems, [
    { label: page.label, key: 'buildingName', quote: 'Marina Gate One' },
    { label: page.label, key: 'amenities (sauna)', quote: 'Sauna' },
  ]);
  assert.match(evidenceFeedback(problems), /buildingName: quote "Marina Gate One" was not found/);
  assert.deepEqual(evidenceProblems({ sources: [parsed.sources[0]] }, [{ ...page, text: page.text + ' Marina Gate One. Sauna.' }]), []);
});

test('the agent schema accepts any label; the route schema still restricts them', () => {
  const free = listingAiOutputSchema(false, []) as any;
  const fixed = listingAiOutputSchema(false, ['a', 'b']) as any;
  assert.deepEqual(free.properties.sources.items.properties.label, { type: 'string' });
  assert.deepEqual(fixed.properties.sources.items.properties.label.enum, ['a', 'b']);
});
