'use client';

import { fmtNumber } from '@/lib/store';

/** Parses a typed amount ("1,250,000", "4.5") to a number; empty or invalid → 0. */
export function num(v) {
  return +String(v || '').replace(/[^\d.]/g, '') || 0;
}

/** Shared estimate disclaimer under every calculator. */
export function CalcNote() {
  return (
    <p className="mt-3 text-2xs leading-[1.5] text-muted">
      Estimates only, based on the assumptions shown. Not a quotation — confirm figures with your bank, the Dubai Land
      Department and your broker.
    </p>
  );
}

/** Labelled, editable assumption with a unit suffix. Amounts of 1,000+ are reformatted with separators on blur. */
export function CalcField({ id, label, value, onChange, suffix }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="calc-input">
        <input
          id={id}
          className="input"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const n = num(e.target.value);
            if (n >= 1000) onChange(fmtNumber(n));
          }}
        />
        {suffix && <span>{suffix}</span>}
      </div>
    </div>
  );
}

/** `fieldSetter(setValues)(key)` → onChange handler that updates one key of a calculator's state object. */
export function fieldSetter(setValues) {
  return (key) => (v) => setValues((s) => ({ ...s, [key]: v }));
}

export function OutLabel({ children }) {
  return <p className="text-2xs tracking-[.1em] text-muted uppercase">{children}</p>;
}
