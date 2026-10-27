'use client';

import { useState } from 'react';
import { fmtAED, fmtNumber } from '@/lib/store';
import { CalcField, CalcNote, OutLabel, fieldSetter, num } from './CalcField';

/** Monthly repayment on a standard amortising loan (ready sale listings). */
export function MortgageCalc({ price }) {
  const [v, setV] = useState({ price: fmtNumber(price), down: '20', rate: '4.5', years: '25' });
  const set = fieldSetter(setV);
  const p = num(v.price);
  const rate = num(v.rate) / 100 / 12;
  const n = num(v.years) * 12;
  const loan = p * (1 - num(v.down) / 100);
  const pay = !n ? 0 : rate ? (loan * rate) / (1 - Math.pow(1 + rate, -n)) : loan / n;

  return (
    <div className="calc">
      <h3 className="h4">Mortgage payments</h3>
      <div className="mt-4 grid gap-3">
        <CalcField id="c-m-price" label="Property price" value={v.price} onChange={set('price')} suffix="AED" />
        <div className="grid grid-cols-2 gap-3">
          <CalcField id="c-m-down" label="Down payment" value={v.down} onChange={set('down')} suffix="%" />
          <CalcField id="c-m-rate" label="Interest rate" value={v.rate} onChange={set('rate')} suffix="%" />
        </div>
        <CalcField id="c-m-years" label="Loan term" value={v.years} onChange={set('years')} suffix="years" />
      </div>
      <div className="calc-out mt-4" aria-live="polite">
        <div>
          <OutLabel>Monthly payment</OutLabel>
          <p className="calc-big">{pay ? fmtAED(pay) : '—'}</p>
        </div>
        <div>
          <OutLabel>Loan amount</OutLabel>
          <p className="calc-big">{loan ? fmtAED(loan) : '—'}</p>
        </div>
      </div>
      <CalcNote />
    </div>
  );
}
