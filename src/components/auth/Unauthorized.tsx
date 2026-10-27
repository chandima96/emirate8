'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Wordmark } from '@/components/layout/Wordmark';
import { safeNext } from './authShared';

/** Sign-in required: carries the requested page through sign-in. */
export function Unauthorized() {
  const next = useSearchParams().get('next');
  const safe = safeNext(next) || '/dashboard';
  const signinHref = next ? '/login?next=' + encodeURIComponent(safe) : '/login';

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="wrap flex h-16 items-center">
        <Wordmark />
      </div>
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-5 py-12 sm:px-0">
        <div className="card p-6 sm:p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mist">
            <i className="bi bi-lock h-5 w-5 text-ink" aria-hidden="true" />
          </span>
          <h1 className="h3 mt-5">Sign in to open the workspace</h1>
          <p className="mt-2 text-[13px] leading-[1.65] text-muted">
            The broker workspace is only available to signed-in members. Sign in, create an account, or open the sample
            workspace to explore Phase 1.
          </p>
          <div className="mt-6 grid gap-2">
            <Link href={signinHref} className="btn btn-dark btn-lg w-full">
              Sign In
            </Link>
            <Link href="/register" className="btn btn-outline btn-lg w-full">
              Create Account
            </Link>
          </div>
        </div>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-1.5 text-[13px] text-muted hover:text-ink"
        >
          <i className="bi bi-arrow-left h-4 w-4" aria-hidden="true" />
          Back to the website
        </Link>
      </div>
    </div>
  );
}
