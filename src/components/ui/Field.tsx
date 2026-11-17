import { cx } from '@/lib/utils';
import { Icon } from './Icon';
import type { ReactNode } from 'react';

export type AiState = 'filled' | 'edited' | 'missing' | 'suggestion' | 'kept';

/** Small AI status tag shown next to a label (or on its own for list widgets). */
export function AiBadge({ state, optional }: { state?: AiState; optional?: ReactNode }) {
  if (!state) return null;
  const tone = {
    filled: 'bg-[#ecebff] text-[#4338a8]',
    suggestion: 'bg-[#ecebff] text-[#4338a8]',
    edited: 'bg-mist text-ink',
    kept: 'bg-mist text-muted',
    missing: optional ? 'bg-[#fdf3d7] text-[#8a6212]' : 'bg-[#fde8e6] text-[#b4372c]',
  }[state];
  const icon = { filled: 'stars', suggestion: 'stars', edited: 'pencil', kept: 'check2', missing: 'exclamation-circle' }[state];
  const text = {
    filled: 'AI-filled',
    suggestion: 'AI suggestion',
    edited: 'Edited',
    kept: 'Not from AI',
    missing: optional ? 'Not found by AI' : 'Not found by AI · required',
  }[state];
  return (
    <span className={cx('inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-semibold', tone)}>
      <Icon name={icon} />
      {text}
    </span>
  );
}

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
  aiState?: AiState;
}) {
  const aiBadge = aiState && <AiBadge state={aiState} optional={optional} />;
  return (
    <div className={cx(
      'field',
      aiState && 'data-[ai=filled]:[&_input]:border-[#c6c5f5] data-[ai=filled]:[&_input]:bg-[#f5f6ff] data-[ai=filled]:[&_select]:border-[#c6c5f5] data-[ai=filled]:[&_select]:bg-[#f5f6ff] data-[ai=filled]:[&_textarea]:border-[#c6c5f5] data-[ai=filled]:[&_textarea]:bg-[#f5f6ff]',
      aiState === 'suggestion' && '[&_input]:border-[#b9c4ff] [&_input]:bg-[#f7f8ff] [&_select]:border-[#b9c4ff] [&_select]:bg-[#f7f8ff] [&_textarea]:border-[#b9c4ff] [&_textarea]:bg-[#f7f8ff]',
      // Not filled by AI: yellow when optional, red when required (see .field[data-ai='missing'] in globals.css).
      aiState === 'missing' && (optional
        ? '[&_input]:border-[#e3c26a] [&_input]:bg-[#fffaeb] [&_select]:border-[#e3c26a] [&_select]:bg-[#fffaeb] [&_textarea]:border-[#e3c26a] [&_textarea]:bg-[#fffaeb]'
        : '[&_input]:border-[#ef9a92] [&_input]:bg-[#fff4f2] [&_select]:border-[#ef9a92] [&_select]:bg-[#fff4f2] [&_textarea]:border-[#ef9a92] [&_textarea]:bg-[#fff4f2]'),
      error && 'invalid',
      className,
    )} data-ai={aiState} data-ai-req={aiState === 'missing' ? (optional ? 'optional' : 'required') : undefined}>
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
