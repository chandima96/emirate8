'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { register } from '@/lib/store';
import { RX, cx, passwordScore } from '@/lib/utils';
import { FieldError, PasswordInput, errProps } from './authShared';
import { GoogleMark } from './LoginForm';

/** Step 2 of buyer registration, shown inside the register wizard. */
export function QuickBuyerForm({
  onSuccess,
  onCancel,
}: {
  embedded?: boolean;
  onSuccess?: (destination: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const query = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const rawNext = query.get('next');
  const safeNext = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = 'Enter your name.';
    if (!RX.email.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (form.password.length < 8 || passwordScore(form.password) < 3) {
      nextErrors.password = 'Use 8+ characters with upper and lower case letters and a number.';
    }
    if (!accepted) nextErrors.terms = 'Please accept the Terms and Privacy Policy.';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    const result = await register({ type: 'buyer', name: form.name.trim(), email: form.email.trim(), password: form.password });
    if (!result.ok) {
      setBusy(false);
      setFormError(result.message || 'Could not create your account.');
      return;
    }

    const destination = safeNext || '/saved';
    if (onSuccess) {
      onSuccess(destination);
      return;
    }
    router.push(destination);
  };

  const score = form.password ? Math.max(1, passwordScore(form.password)) : 0;
  const scoreLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][score] || '';

  return (
    <div className="w-full">
      <h2 className="auth-rise h2 text-[26px] lg:text-[30px]" tabIndex={-1} data-step-heading style={{ '--d': 0 } as React.CSSProperties}>
        Create Your <em className="f font-normal">Buyer Account.</em>
      </h2>
      <p className="auth-rise mt-2 text-[14px] text-muted" style={{ '--d': 1 } as React.CSSProperties}>
        Free to join. Save properties, contact brokers and follow developer updates.
      </p>

      <a
        href={`/api/auth/google?next=${encodeURIComponent(safeNext || '/saved')}`}
        className="auth-rise auth-press btn btn-outline btn-lg mt-6 w-full"
        style={{ '--d': 2 } as React.CSSProperties}
      >
        <GoogleMark />
        Continue with Google
      </a>
      <div className="auth-rise mt-6 flex items-center gap-3 text-2xs tracking-[.12em] text-muted uppercase" style={{ '--d': 3 } as React.CSSProperties}>
        <span className="h-px flex-1 bg-line" />
        or sign up with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form className="auth-rise mt-6 space-y-4" style={{ '--d': 4 } as React.CSSProperties} noValidate onSubmit={submit}>
        <div className={cx('field', errors.name && 'invalid')}>
          <label className="label" htmlFor="buyer-name">Full name</label>
          <input id="buyer-name" name="name" className="input" placeholder="Your name" value={form.name} onChange={update('name')} autoComplete="name" {...errProps('buyer-name', errors.name)} />
          <FieldError id="buyer-name">{errors.name}</FieldError>
        </div>

        <div className={cx('field', errors.email && 'invalid')}>
          <label className="label" htmlFor="buyer-email">Email address</label>
          <input id="buyer-email" name="email" className="input" type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} autoComplete="email" {...errProps('buyer-email', errors.email)} />
          <FieldError id="buyer-email">{errors.email}</FieldError>
        </div>

        <div className={cx('field', errors.password && 'invalid')}>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="buyer-password">Create a password</label>
            {score > 0 && <span className={cx('text-2xs font-semibold', score < 3 ? 'text-warn' : 'text-ok')}>{scoreLabel}</span>}
          </div>
          <PasswordInput id="buyer-password" name="password" placeholder="At least 8 characters" autoComplete="new-password" value={form.password} onChange={update('password')} invalid={!!errors.password} {...errProps('buyer-password', errors.password)} />
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((level) => <span key={level} className={cx('h-1 flex-1 rounded-full', score >= level ? (score < 3 ? 'bg-warn' : 'bg-ok') : 'bg-line')} />)}
          </div>
          <p className="hint">Use upper and lower case letters plus a number.</p>
          <FieldError id="buyer-password">{errors.password}</FieldError>
        </div>

        <div className={cx('field', errors.terms && 'invalid')}>
          <label className="check items-start">
            <input type="checkbox" checked={accepted} onChange={(event) => { setAccepted(event.target.checked); setErrors((current) => ({ ...current, terms: '' })); }} />
            <span className="text-[12px] leading-5">I agree to the <Link className="link" href="/terms">Terms</Link> and <Link className="link" href="/privacy">Privacy Policy</Link>.</span>
          </label>
          <FieldError id="buyer-terms">{errors.terms}</FieldError>
        </div>

        {formError && <p className="rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[13px] leading-5 text-danger" role="alert">{formError}</p>}
        <div className="!mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          {onCancel && (
            <button type="button" className="auth-press btn btn-ghost" onClick={onCancel}>
              <i className="bi bi-arrow-left" aria-hidden="true" />
              Back
            </button>
          )}
          <button type="submit" className="auth-press btn btn-dark btn-lg ml-auto" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating account
              </>
            ) : (
              <>
                Create buyer account
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
