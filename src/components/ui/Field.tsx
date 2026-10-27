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
}: {
  id?: string;
  label?: ReactNode;
  optional?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
  labelAside?: ReactNode;
}) {
  return (
    <div className={cx('field', error && 'invalid', className)}>
      {label &&
        (labelAside ? (
          <div className="flex justify-between gap-2">
            <label className="label" htmlFor={id}>
              {label}
              {optional && <span className="opt"> ({optional})</span>}
            </label>
            {labelAside}
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
