import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditsFromUsage, creditPeriod } from '../src/lib/aiCreditMath';
import { PLAN_CATALOG } from '../src/config/plans';

test('credits weight output 5x and cache reads 0.1x, rounding up', () => {
  assert.equal(creditsFromUsage({ input_tokens: 6362, output_tokens: 700 }), 10); // measured pasted-text autofill
  assert.equal(creditsFromUsage({ input_tokens: 329, output_tokens: 517 }), 3); // measured Arabic translation
  assert.equal(creditsFromUsage({ input_tokens: 500, cache_read_input_tokens: 5800, output_tokens: 600 }), 5);
  assert.equal(creditsFromUsage({ input_tokens: 1000, cache_creation_input_tokens: 4000 }), 6);
  assert.equal(creditsFromUsage({ input_tokens: 1 }), 1);
  assert.equal(creditsFromUsage(null), 0);
  assert.equal(creditsFromUsage({ input_tokens: -5, output_tokens: Number.NaN }), 0);
});

test('the credit month runs on Dubai time', () => {
  // 30 Nov 21:00 UTC is already 1 Dec 01:00 in Dubai.
  const { start, resetsAt } = creditPeriod(new Date('2026-11-30T21:00:00Z'));
  assert.equal(start.toISOString(), '2026-11-30T20:00:00.000Z');
  assert.equal(resetsAt.toISOString(), '2026-12-31T20:00:00.000Z');
  const nov = creditPeriod(new Date('2026-11-18T10:00:00Z'));
  assert.equal(nov.start.toISOString(), '2026-10-31T20:00:00.000Z');
  assert.equal(nov.resetsAt.toISOString(), '2026-11-30T20:00:00.000Z');
});

test('plan allowances match AI-credits.md', () => {
  const expected: Record<string, number> = {
    'broker-bronze': 1000, 'broker-silver': 3000, 'broker-gold': 8000,
    'agency-bronze': 3000, 'agency-silver': 8000, 'agency-gold': 25000,
    'developer-bronze': 3000, 'developer-silver': 8000, 'developer-gold': 25000,
  };
  for (const [id, credits] of Object.entries(expected)) assert.equal(PLAN_CATALOG[id].aiCredits, credits, id);
});
