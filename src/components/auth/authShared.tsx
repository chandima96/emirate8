'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/utils';
import { currentUser } from '@/lib/store';

/* Workspace routes a buyer account cannot open (old appPages regex). */
const APP_PAGES = /^\/(dashboard|listings|network|selected|subscription|profile|account|enquiries)(\/|\?|$)/;
/* Same-origin, path-only `next` values (old: /^[a-z-]+\.html(\?[\w=&%.-]*)?$/). */
const SAFE_NEXT = /^\/(?!\/)[\w\-/]*(\?[\w=&%.-]*)?$/;

export function safeNext(next) {
  return next && SAFE_NEXT.test(next) ? next : null;
}

/** Where to go after sign-in: `next` when allowed for the role, otherwise the role's home. */
export function afterSignIn(next, isBuyer) {
  const n = safeNext(next);
  if (n && !(isBuyer && APP_PAGES.test(n))) return n;
  return isBuyer ? '/' : '/dashboard';
}

/** Password input with the show/hide toggle button (old data-toggle-password). */
export function PasswordInput({ id, className = undefined, invalid, describedBy = undefined, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={cx('input pr-11', className)}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={invalid ? describedBy || id + '-err' : undefined}
        {...props}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
      >
        <Icon name={show ? 'eye-slash' : 'eye'} className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Inline field error in the old `.err` markup. */
export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p className="err" id={id + '-err'}>
      <Icon name="exclamation-circle" className="h-3.5 w-3.5" />
      <span>{children}</span>
    </p>
  );
}

export function errProps(id, error) {
  return error ? { 'aria-invalid': true, 'aria-describedby': id + '-err' } : {};
}

/**
 * "You're already signed in" note for auth pages. Mount it once the session is ready: like the old page script it
 * checks the session once on load, so it does not pop in after signing in or registering on the page.
 */
export function SignedInNote({ className }) {
  const [shown] = useState(() => !!currentUser());
  if (!shown) return null;
  return (
    <div
      className={cx(
        'flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-3 text-[13px]',
        className,
      )}
    >
      <span className="text-muted">You&apos;re already signed in on this browser.</span>
      <Link href="/dashboard" className="link">
        Open workspace
      </Link>
    </div>
  );
}
