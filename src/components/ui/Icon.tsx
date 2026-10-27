import { cx } from '@/lib/utils';

/** Bootstrap Icons (web font). Size with the same h-* / w-* utilities used across the design system. */
export function Icon({ name, className, label }: { name: string; className?: string; label?: string }) {
  return (
    <i
      className={cx('bi', 'bi-' + name, className)}
      aria-hidden={label ? undefined : 'true'}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}
