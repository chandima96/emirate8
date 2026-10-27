'use client';

import { useState } from 'react';
import { fmtAED, fmtNumber } from '@/lib/store';
import { cx } from '@/lib/utils';
import { CalcField, CalcNote, fieldSetter, num } from './CalcField';

const pct = (n) => +n.toFixed(2);

/** Off-plan schedule builder — defaults come from the developer plan on the listing, every stage is editable. */
export function PaymentPlanCalc({ price, plan = [] }) {
  const sum = (st) => plan.filter((m) => m.stage === st).reduce((s, m) => s + (+m.pct || 0), 0);
  const con = plan.filter((m) => m.stage === 'construction').length || 4;
  const [v, setV] = useState(() => ({
    price: fmtNumber(price),
    book: String(sum('booking') || 10),
    con: String(sum('construction') || 50),
    hand: String(sum('handover') || 40),
    post: String(sum('post') || 0),
    n: String(con),
  }));
  const set = fieldSetter(setV);

  const p = num(v.price);
  const b = num(v.book);
  const c = num(v.con);
  const h = num(v.hand);
  const po = num(v.post);
  const n = Math.max(1, Math.round(num(v.n)));
  const tot = b + c + h + po;
  const rows: [string, number, string][] = [['Booking deposit', b, 'On reservation']];
  for (let i = 1; i <= n; i++) rows.push([`Construction instalment ${i}`, c / n, 'During construction']);
  rows.push(['Handover payment', h, 'At completion']);
  if (po) rows.push(['Post-handover', po, 'After handover']);
  const ok = Math.round(tot) === 100;

  return (
    <div className="calc lg:col-span-2">
      <h3 className="h4">Payment plan calculator</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <CalcField id="c-pp-price" label="Property price" value={v.price} onChange={set('price')} suffix="AED" />
        <CalcField id="c-pp-book" label="Booking deposit" value={v.book} onChange={set('book')} suffix="%" />
        <CalcField id="c-pp-con" label="During construction" value={v.con} onChange={set('con')} suffix="%" />
        <CalcField id="c-pp-hand" label="On handover" value={v.hand} onChange={set('hand')} suffix="%" />
        <CalcField id="c-pp-post" label="Post-handover" value={v.post} onChange={set('post')} suffix="%" />
        <CalcField id="c-pp-n" label="Construction instalments" value={v.n} onChange={set('n')} suffix="#" />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>When</th>
              <th className="text-right">Share</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, share, when]) => (
              <tr key={label}>
                <td className="font-medium text-ink">{label}</td>
                <td className="text-muted">{when}</td>
                <td className="text-right tabular-nums">{pct(share)}%</td>
                <td className="text-right font-semibold text-ink tabular-nums">{fmtAED((p * share) / 100)}</td>
              </tr>
            ))}
            <tr>
              <td className="font-semibold text-ink">Total</td>
              <td />
              <td className="text-right font-semibold tabular-nums">{pct(tot)}%</td>
              <td className="text-right font-semibold text-ink tabular-nums">{fmtAED((p * tot) / 100)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={cx('mt-2 text-xs', ok ? 'text-ok' : 'text-danger')} aria-live="polite">
        {ok
          ? 'The schedule adds up to 100% of the price.'
          : `The percentages add up to ${pct(tot)}% — adjust them to total 100%.`}
      </p>
      <CalcNote />
    </div>
  );
}
