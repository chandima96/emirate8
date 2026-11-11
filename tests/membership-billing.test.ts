import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvText, monthlySummary, type Payment } from '../src/lib/membership';
const payment = (amount: number, status: string, transactionDate: string) =>
  ({ amount, status, transactionDate }) as Payment;
test('billing totals include only paid revenue in the local current month', () => {
  const result = monthlySummary(
    [
      payment(50.15, 'paid', '2026-11-01T00:00:00+05:30'),
      payment(100.1, 'paid', '2026-11-05T00:00:00+05:30'),
      payment(80, 'failed', '2026-11-05T00:00:00+05:30'),
      payment(90, 'pending', '2026-11-05T00:00:00+05:30'),
      payment(500, 'paid', '2026-10-20T00:00:00+05:30'),
    ],
    new Date('2026-11-11T00:00:00+05:30'),
  );
  assert.deepEqual(result, { revenue: 150.25, successful: 2, failed: 1 });
});
test('month boundaries follow Sri Lanka time', () => {
  assert.equal(
    monthlySummary([payment(50, 'paid', '2026-10-31T20:00:00Z')], new Date('2026-11-01T01:00:00+05:30')).revenue,
    50,
  );
});
test('CSV exports escape quotes and protect spreadsheet formula cells', () => {
  const output = csvText([
    ['Name', 'Email'],
    ['A, "B"', '=SUM(A1)'],
    ['\t+cmd', null],
  ]);
  assert.ok(output.includes('"A, ""B"""'));
  assert.ok(output.includes('"\'=SUM(A1)"'));
  assert.ok(output.includes('"\'\t+cmd"'));
});
