'use client';

import { joinWaitlistAction } from '@/app/actions';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { RX } from '@/lib/utils';

/** Sell page: owner-tools waitlist stored in Supabase. */
export function OwnerWaitlist() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!RX.email.test(email.trim())) {
      setError('Enter a valid email address.');
      e.currentTarget.querySelector('input')?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await joinWaitlistAction({ email: v });
      if (!result.ok) throw new Error(result.error || 'Could not join the list.');
      setEmail('');
      setDone(true);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the list.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={'field' + (error ? ' invalid' : '')} noValidate onSubmit={submit}>
      <label className="label" htmlFor="wl-email">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="wl-email"
          type="email"
          className="input flex-1"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'wl-email-err' : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
        />
        <button type="submit" className="btn btn-dark" disabled={busy}>
          Join the list
        </button>
      </div>
      <p className="mt-2 text-[13px] text-muted" aria-live="polite">
        {done ? (
          <>
            <span className="font-semibold text-ink">You’re on the list.</span> Your signup is saved securely.
          </>
        ) : (
          'We’ll only use this to tell you when owner tools launch.'
        )}
      </p>
      {error && (
        <p className="err" id="wl-email-err">
          <Icon name="exclamation-circle" className="h-3.5 w-3.5" />
          <span>{error}</span>
        </p>
      )}
    </form>
  );
}
