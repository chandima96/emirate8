'use client';

import { useState } from 'react';
import { fmtAED, fmtNumber } from '@/lib/store';
import { CalcField, CalcNote, OutLabel, fieldSetter, num } from './CalcField';

/** One-off costs on top of the price (DLD / Oqood, agency, trustee, admin, mortgage registration). */
export function PurchaseCostsCalc({ price, offplan }) {
  const [v, setV] = useState({
    price: fmtNumber(price),
    dld: '4',
    agent: offplan ? '0' : '2',
    trustee: offplan ? '0' : price >= 500000 ? '4,200' : '2,100',
    admin: offplan ? '1,250' : '580',
    mort: !offplan,
  });
  const set = fieldSetter(setV);
  const p = num(v.price);
  const rows = (
    [
      ['Land Department fee', (p * num(v.dld)) / 100],
      ['Agency fee incl. VAT', ((p * num(v.agent)) / 100) * 1.05],
      ['Trustee fee', num(v.trustee)],
      ['Admin & title deed', num(v.admin)],
      ['Mortgage registration', v.mort ? p * 0.8 * 0.0025 + 290 : 0],
    ] satisfies [string, number][]
  ).filter((r) => r[1] > 0);
  const total = rows.reduce((s, r) => s + r[1], 0);

  return (
    <div className="calc">
      <h3 className="h4">Purchase costs</h3>
      <div className="mt-4 grid gap-3">
        <CalcField id="c-k-price" label="Property price" value={v.price} onChange={set('price')} suffix="AED" />
        <div className="grid grid-cols-2 gap-3">
          <CalcField
            id="c-k-dld"
            label={offplan ? 'DLD / Oqood fee' : 'DLD transfer fee'}
            value={v.dld}
            onChange={set('dld')}
            suffix="%"
          />
          <CalcField id="c-k-agent" label="Agency fee (+5% VAT)" value={v.agent} onChange={set('agent')} suffix="%" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CalcField
            id="c-k-trustee"
            label="Registration trustee fee"
            value={v.trustee}
            onChange={set('trustee')}
            suffix="AED"
          />
          <CalcField id="c-k-admin" label="Admin & title deed" value={v.admin} onChange={set('admin')} suffix="AED" />
        </div>
        <label className="check">
          <input
            type="checkbox"
            id="c-k-mort"
            checked={v.mort}
            onChange={(e) => setV((s) => ({ ...s, mort: e.target.checked }))}
          />
          <span>Include mortgage registration (0.25% of an 80% loan + AED 290)</span>
        </label>
      </div>
      <div className="calc-out mt-4" aria-live="polite">
        <div className="col-span-2">
          <OutLabel>Estimated upfront costs (excluding price)</OutLabel>
          <p className="calc-big">{fmtAED(total)}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-muted">
        {rows.map(([k, val]) => (
          <li key={k} className="flex justify-between gap-3">
            <span>{k}</span>
            <span className="text-text tabular-nums">{fmtAED(val)}</span>
          </li>
        ))}
      </ul>
      <CalcNote />
    </div>
  );
}
