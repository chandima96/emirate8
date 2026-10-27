'use client';

import { useState } from 'react';
import { invalidProps } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { fmtNumber } from '@/lib/store';

const toNumber = (raw) => {
  const d = String(raw).replace(/[^\d.]/g, '');
  return d === '' ? '' : +d;
};

/**
 * Numeric text input (old data-num / data-money): stores a number, keeps what the user types while focused,
 * and shows money values with thousands separators when not focused.
 */
export function NumInput({
  id,
  value,
  onValue,
  money = undefined,
  error = undefined,
  parse = toNumber,
  className = 'input',
  ...rest
}) {
  const [text, setText] = useState(null);
  const shown = text != null ? text : money ? (value ? fmtNumber(value) : '') : value == null ? '' : String(value);
  return (
    <input
      id={id}
      className={className}
      inputMode="numeric"
      value={shown}
      onFocus={() => setText(shown)}
      onBlur={() => setText(null)}
      onChange={(e) => {
        setText(e.target.value);
        onValue(parse(e.target.value));
      }}
      {...invalidProps(id, error)}
      {...rest}
    />
  );
}

/** Select whose options are plain strings; an optional placeholder option has the empty value. */
export function OptionSelect({
  id,
  value,
  onValue,
  options,
  placeholder = undefined,
  error,
  className = 'select',
  ...rest
}) {
  const v = value == null ? '' : String(value);
  const values = options.map((o) => String(Array.isArray(o) ? o[0] : o));
  return (
    <select
      id={id}
      className={className}
      value={values.indexOf(v) > -1 ? v : placeholder != null ? '' : values[0]}
      onChange={(e) => onValue(e.target.value)}
      {...invalidProps(id, error)}
      {...rest}
    >
      {placeholder != null && <option value="">{placeholder}</option>}
      {options.map((o) =>
        Array.isArray(o) ? (
          <option key={o[0]} value={o[0]}>
            {o[1]}
          </option>
        ) : (
          <option key={o}>{o}</option>
        ),
      )}
    </select>
  );
}

/** Inline error for non-field groups (radio groups, payment plan). */
export function GroupError({ id, msg }) {
  return (
    <p className={msg ? 'err flex' : 'err'} id={id} role={msg ? 'alert' : undefined}>
      {msg && (
        <>
          <Icon name="exclamation-circle" className="h-3.5 w-3.5" />
          {msg}
        </>
      )}
    </p>
  );
}
