'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { register } from '@/lib/store';
import { RX, cx, passwordScore } from '@/lib/utils';
import { FieldError, PasswordInput, errProps } from './authShared';

export function QuickBuyerForm({ embedded = false, onSuccess = undefined, onCancel = undefined }) {
  const router = useRouter();
  const query = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

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

    const destination = query.get('next') || '/saved';
    if (onSuccess) {
      onSuccess(destination);
      return;
    }
    router.push(destination);
  };

  const score = form.password ? Math.max(1, passwordScore(form.password)) : 0;
  const scoreLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][score] || '';

  return (
    <div className={embedded ? 'w-full' : 'mx-auto flex min-h-screen w-full max-w-[440px] flex-col justify-center px-5 py-10'}>
      {embedded && onCancel && (
        <button type="button" className="mb-5 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink" onClick={onCancel}>
          <Icon name="arrow-left" className="h-3.5 w-3.5" />
          Back to sign-up options
        </button>
      )}

      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage text-ink-deep">
          <Icon name="person-plus" className="h-5 w-5" />
        </span>
        <div>
          <p className="eyebrow">Buyer account</p>
          <h1 className="h2 mt-2 text-[25px]">Start with a faster account.</h1>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">Save properties, contact brokers and follow developer updates with a simple free account.</p>

      

      <form className="mt-6 space-y-4" noValidate onSubmit={submit}>
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
        <button type="submit" className="btn btn-dark btn-lg w-full" disabled={busy} aria-busy={busy}>
          {busy ? <><Icon name="arrow-repeat" className="h-4 w-4 animate-spin" /> Creating account…</> : <>Create buyer account <Icon name="arrow-right" className="h-4 w-4" /></>}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">Already registered? <Link className="link" href="/login">Sign in</Link></p>
    </div>
  );
}
