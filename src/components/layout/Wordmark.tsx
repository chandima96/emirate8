import Link from 'next/link';
import { cx } from '@/lib/utils';

export function LogoMark({ className = 'h-[22px] w-[22px]' }) {
  return (
    <svg className={cx('shrink-0', className)} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="3" fill="currentColor" />
      <rect x="5" y="9" width="3" height="10" fill="#A9C0AF" />
      <rect x="10.5" y="4.5" width="3" height="14.5" fill="#FFFFFF" />
      <rect x="16" y="11.5" width="3" height="7.5" fill="#A9C0AF" />
    </svg>
  );
}

/** Emirate08 wordmark. `dark` renders it for dark surfaces (workspace sidebar). */
export function Wordmark({
  href = '/',
  size = 'text-[19px]',
  className = undefined,
  dark = false,
  label = 'Emirate08 home',
}) {
  return (
    <Link
      href={href}
      className={cx('inline-flex items-center gap-2', dark ? 'text-white' : 'text-ink', className)}
      aria-label={label}
    >
      <span className={dark ? 'text-white/10' : 'text-ink'}>
        <LogoMark />
      </span>
      <span className={cx('font-display font-semibold tracking-[-0.02em]', size)}>
        Emirate<span className="f font-normal">08</span>
      </span>
    </Link>
  );
}
