'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark } from '@/components/layout/Wordmark';

function ChangePasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/agency-dashboard';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [controlAccount, setControlAccount] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/app-session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = await response.json();
      if (result.user) return;
      const adminResponse = await fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'session' }) });
      const adminResult = await adminResponse.json();
      if (adminResult.user) setControlAccount(true);
      else router.replace('/login');
    })();
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Your new password must be at least 8 characters.');
    if (password !== confirmation) return setError('The passwords do not match.');
    setBusy(true);
    const response = await fetch(controlAccount ? '/api/admin' : '/api/app-auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: controlAccount ? 'change-password' : 'first-login-password', password }),
    });
    const result = await response.json();
    setBusy(false);
    if (result.error) return setError(result.error);
    router.replace(next);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-deep px-5 py-12">
      <div className="w-full max-w-[480px] rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
        <Wordmark />
        <p className="eyebrow mt-12 text-sage">First sign-in</p>
        <h1 className="h2 mt-3 text-[34px]">
          Set your <em className="f font-normal">password.</em>
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Your agency invited you with a temporary password. Choose a new password before entering the workspace.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            className="input"
            type="password"
            placeholder="New password (8+ characters)"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button className="btn btn-dark btn-lg w-full" disabled={busy}>
            {busy ? 'Updating password…' : 'Set new password'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ChangePasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-ink-deep" />}><ChangePasswordForm /></Suspense>;
}
