import { cx } from '@/lib/utils';
import { Icon } from './Icon';
import type { ReactNode } from 'react';

/** Label + control + hint + inline error, matching the `.field` / `.err` styles. */
export function Field({
  id,
  label,
  optional,
  hint,
  error,
  className,
  children,
  labelAside,
  aiState,
}: {
  id?: string;
  label?: ReactNode;
  optional?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
  labelAside?: ReactNode;
  aiState?: 'filled' | 'edited' | 'missing' | 'suggestion';
}) {
  const aiBadge = aiState && <span className={cx('inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-semibold', aiState === 'filled' && 'bg-[#ecebff] text-[#4338a8]', aiState === 'suggestion' && 'bg-[#ecebff] text-[#4338a8]', aiState === 'edited' && 'bg-mist text-ink', aiState === 'missing' && 'bg-warn-soft text-warn')}><Icon name={aiState === 'filled' || aiState === 'suggestion' ? 'stars' : aiState === 'edited' ? 'pencil' : 'exclamation-circle'} />{aiState === 'filled' ? 'AI-filled' : aiState === 'suggestion' ? 'AI suggestion' : aiState === 'edited' ? 'Edited' : 'Needs your input'}</span>;
  return (
    <div className={cx(
      'field',
      aiState && 'data-[ai=filled]:[&_input]:border-[#c6c5f5] data-[ai=filled]:[&_input]:bg-[#f5f6ff] data-[ai=filled]:[&_select]:border-[#c6c5f5] data-[ai=filled]:[&_select]:bg-[#f5f6ff] data-[ai=filled]:[&_textarea]:border-[#c6c5f5] data-[ai=filled]:[&_textarea]:bg-[#f5f6ff]',
      aiState === 'suggestion' && '[&_input]:border-[#b9c4ff] [&_input]:bg-[#f7f8ff] [&_select]:border-[#b9c4ff] [&_select]:bg-[#f7f8ff] [&_textarea]:border-[#b9c4ff] [&_textarea]:bg-[#f7f8ff]',
      aiState === 'missing' && '[&_input]:border-dashed [&_input]:border-[#d3ae64] [&_select]:border-dashed [&_select]:border-[#d3ae64] [&_textarea]:border-dashed [&_textarea]:border-[#d3ae64]',
      error && 'invalid',
      className,
    )} data-ai={aiState}>
      {label &&
        (labelAside || aiState ? (
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <label className="label !mb-0" htmlFor={id}>
                {label}
                {optional && <span className="opt"> ({optional})</span>}
              </label>
              {aiBadge}
            </div>
            {labelAside && <span className="inline-flex flex-wrap items-center gap-1">{labelAside}</span>}
          </div>
        ) : (
          <label className="label" htmlFor={id}>
            {label}
            {optional && <span className="opt"> ({optional})</span>}
          </label>
        ))}
      {children}
      {hint && <p className="hint">{hint}</p>}
      {error && (
        <p className="err" id={id ? id + '-err' : undefined} role="alert">
          <Icon name="exclamation-circle" className="h-3.5 w-3.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Accessible on/off switch built on a visually hidden checkbox. */
export function Switch({ id, checked, onChange, label, description, className }) {
  return (
    <label className={cx('flex cursor-pointer items-center justify-between gap-4', className)} htmlFor={id}>
      <span>
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span className="relative">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle" aria-hidden="true" />
      </span>
    </label>
  );
}

/** Props for an input that shows an error state. */
export function invalidProps(id, error) {
  return error ? { 'aria-invalid': true, 'aria-describedby': id + '-err' } : {};
}
