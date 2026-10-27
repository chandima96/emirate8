'use client';

import { useState } from 'react';
import { fmtAED, fmtNumber } from '@/lib/store';
import { CalcField, CalcNote, OutLabel, fieldSetter, num } from './CalcField';

const CHEQUES = ['1', '2', '4', '6', '12'];

/** Rent-to-income ratio and the amount of each cheque (rental listings). */
export function RentAffordabilityCalc({ price, cheques }) {
  const initial = String(cheques || 4);
  const [v, setV] = useState({
    income: '35,000',
    rent: fmtNumber(price),
    cheques: CHEQUES.includes(initial) ? initial : CHEQUES[0],
  });
  const set = fieldSetter(setV);
  const inc = num(v.income);
  const r = num(v.rent);
  const n = +v.cheques || 1;
  const ratio = inc ? (r / (inc * 12)) * 100 : 0;
  const advice = !inc
    ? ''
    : ratio <= 30
      ? 'Within the common guideline of spending about 30% or less of income on rent.'
      : ratio <= 40
        ? 'Above the 30% guideline — check the rest of your monthly budget.'
        : 'Well above the 30% guideline — a lower rent may be more comfortable.';

  return (
    <div className="calc">
      <h3 className="h4">Rental affordability</h3>
      <div className="mt-4 grid gap-3">
        <CalcField
          id="c-income"
          label="Monthly household income"
          value={v.income}
          onChange={set('income')}
          suffix="AED"
        />
        <CalcField id="c-rent" label="Annual rent" value={v.rent} onChange={set('rent')} suffix="AED" />
        <div>
          <label className="label" htmlFor="c-cheques">
            Number of payments
          </label>
          <select
            id="c-cheques"
            className="select"
            value={v.cheques}
            onChange={(e) => setV((s) => ({ ...s, cheques: e.target.value }))}
          >
            {CHEQUES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="calc-out mt-4" aria-live="polite">
        <div>
          <OutLabel>Rent-to-income</OutLabel>
          <p className="calc-big">{inc ? ratio.toFixed(1) + '%' : '—'}</p>
        </div>
        <div>
          <OutLabel>Each payment</OutLabel>
          <p className="calc-big">{r ? fmtAED(r / n) : '—'}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{advice}</p>
      <CalcNote />
    </div>
  );
}
