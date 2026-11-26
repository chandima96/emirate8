'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { MAX_PROPERTY_BROKERS } from '@/lib/propertyBrokers';
import { cx } from '@/lib/utils';

type BrokerOption = { id: string | number; name: string; email?: string; brn?: string };

/**
 * Choose up to MAX_PROPERTY_BROKERS brokers for a property. There is no primary broker; the order chosen is
 * the order they are shown in. Used by the agency team step and the developer representation step.
 */
export function BrokerPicker({
  id,
  label,
  options,
  value,
  onChange,
  disabled = false,
  error = '',
  emptyText = 'No brokers are available yet.',
}: {
  id: string;
  label: string;
  options: BrokerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: string;
  emptyText?: string;
}) {
  const [query, setQuery] = useState('');
  const selected = (value || []).map(String);
  const full = selected.length >= MAX_PROPERTY_BROKERS;
  const byId = new Map(options.map((o) => [String(o.id), o]));
  const q = query.trim().toLowerCase();
  const visible = options.filter((o) => !q || [o.name, o.email, o.brn].join(' ').toLowerCase().includes(q));

  const toggle = (brokerId: string, on: boolean) => {
    if (on) {
      if (!selected.includes(brokerId) && !full) onChange([...selected, brokerId]);
    } else onChange(selected.filter((x) => x !== brokerId));
  };

  return (
    <div className="field mt-4" id={id} tabIndex={-1}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">{label}</span>
        <span className={cx('text-2xs font-semibold', full ? 'text-warn' : 'text-muted')} aria-live="polite">
          {selected.length} / {MAX_PROPERTY_BROKERS} selected
        </span>
      </div>

      {selected.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label="Selected brokers">
          {selected.map((brokerId) => (
            <li key={brokerId} className="chip">
              {byId.get(brokerId)?.name || 'Broker #' + brokerId}
              {!disabled && (
                <button
                  type="button"
                  className="-mr-0.5 text-muted hover:text-danger"
                  aria-label={'Remove ' + (byId.get(brokerId)?.name || 'broker')}
                  onClick={() => toggle(brokerId, false)}
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {options.length > 6 && (
        <input
          type="search"
          className="input input-sm mb-2 h-9"
          placeholder="Search brokers by name, email or BRN"
          aria-label="Search brokers"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {options.length ? (
        <ul className={cx('max-h-56 overflow-y-auto rounded-lg border bg-white', error ? 'border-danger' : 'border-line')}>
          {visible.map((o) => {
            const oid = String(o.id);
            const on = selected.includes(oid);
            return (
              <li key={oid} className="border-b border-line last:border-b-0">
                <label className={cx('check px-3 py-2', (disabled || (full && !on)) && 'cursor-not-allowed opacity-50')}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={disabled || (full && !on)}
                    onChange={(e) => toggle(oid, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{o.name}</span>
                    {(o.email || o.brn) && (
                      <span className="block truncate text-xs text-muted">{[o.brn && 'BRN ' + o.brn, o.email].filter(Boolean).join(' · ')}</span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
          {!visible.length && <li className="px-3 py-2 text-xs text-muted">No brokers match “{query}”.</li>}
        </ul>
      ) : (
        <p className="rounded-md border border-line bg-mist p-3 text-sm text-muted">{emptyText}</p>
      )}

      {full && <p className="hint">A property can have at most {MAX_PROPERTY_BROKERS} brokers. Remove one to add another.</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-danger" role="alert">
          <Icon name="exclamation-circle" className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
