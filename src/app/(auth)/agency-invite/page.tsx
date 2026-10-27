'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark } from '@/components/layout/Wordmark';

function AcceptAgencyInvite() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [message, setMessage] = useState('Checking your invitation…');
  useEffect(() => {
    if (!token) { setMessage('This invitation link is invalid.'); return; }
    void (async () => {
      const session = await fetch('/api/app-session', { credentials: 'same-origin', cache: 'no-store' }).then((response) => response.json());
      if (!session.user) { router.replace(`/login?next=${encodeURIComponent(`/agency-invite?token=${token}`)}`); return; }
      const response = await fetch('/api/role-workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'accept-team-invite', token }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || 'This invitation could not be accepted.'); return; }
      setMessage('Invitation accepted. Opening your agency workspace…');
      window.location.assign('/agency-dashboard');
    })();
  }, [router, token]);
  return <main className="flex min-h-screen items-center justify-center bg-ink-deep px-5"><div className="w-full max-w-md rounded-2xl bg-white p-8"><Wordmark /><p className="mt-8 text-sm text-muted">{message}</p></div></main>;
}

export default function AgencyInvitePage() {
  return <Suspense fallback={<main className="min-h-screen bg-ink-deep" />}><AcceptAgencyInvite /></Suspense>;
}
