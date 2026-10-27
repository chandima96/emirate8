'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useFeedback } from '@/components/providers/FeedbackProvider';

/** One-off notices passed in the query string by redirects (?welcome=1, ?deleted=1, ?workspace=brokers). */
export function QueryToasts() {
  const { toast } = useFeedback();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const q = new URLSearchParams(window.location.search);
    setTimeout(() => {
      if (q.get('welcome'))
        toast('Welcome to Emirate08 — your buyer account is ready. Save properties with the heart icon.');
      if (q.get('deleted')) toast('Your account and its data were deleted.', { icon: 'trash3' });
      if (q.get('workspace'))
        toast(
          <>
            The workspace is for broker and agency accounts.{' '}
            <Link className="underline" href="/register?type=broker">
              Create a broker account
            </Link>
          </>,
          { icon: 'info-circle', duration: 6000 },
        );
      const authError = q.get('authError');
      if (authError === 'google-not-configured')
        toast('Google sign-in is not configured yet. Use email sign-up or add the Google OAuth environment variables.', {
          icon: 'info-circle',
          duration: 7000,
        });
      else if (authError === 'google-email-exists')
        toast('That email already has an account. Sign in with email instead.', { icon: 'info-circle', duration: 6000 });
      else if (authError && authError.startsWith('google-'))
        toast('Google sign-in could not be completed. Please try again or use email sign-up.', {
          icon: 'exclamation-circle',
          duration: 6000,
        });
    }, 300);
  }, [toast]);
  return null;
}
