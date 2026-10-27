'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark } from '@/components/layout/Wordmark';
import { useSession } from '@/components/providers/SessionProvider';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { login, role } from '@/lib/store';
import { cx } from '@/lib/utils';
import { PasswordInput, FieldError, errProps, SignedInNote, afterSignIn } from './authShared';

export function LoginForm() {
  const q = useSearchParams();
  const next = q.get('next');
  const router = useRouter();
  const { ready } = useSession();
  const { toast } = useFeedback();
  const [values, setValues] = useState({ login: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(!!next);
  const loginRef = useRef(null);
  const passRef = useRef(null);
  const submitRef = useRef(null);
  const toasted = useRef(false);

  useEffect(() => {
    if (q.get('signedout') && !toasted.current) {
      toasted.current = true;
      toast('You’ve been signed out.', { icon: 'box-arrow-right' });
    }
  }, [q, toast]);

  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: null }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setNotice(false);
    const er: Record<string, string> = {};
    if (!values.login.trim()) er.login = 'Enter your email address or mobile number.';
    if (!values.password) er.password = 'Enter your password.';
    if (er.login || er.password) {
      setErrors(er);
      (values.login.trim() ? passRef : loginRef).current?.focus();
      return;
    }
    setBusy(true);
    login(values.login, values.password, remember).then(async (res) => {
      if (!res.ok && values.login.includes('@')) {
        try {
          const controlResponse = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'login', email: values.login, password: values.password }),
          });
          const controlResult = await controlResponse.json();
          if (controlResponse.ok && controlResult.user) {
            const destination = controlResult.user.mustChangePassword
              ? `/change-password?next=${encodeURIComponent(next || '/control-room')}`
              : next || '/control-room';
            router.push(destination);
            return;
          }
        } catch {}
      }
      setBusy(false);
      if (!res.ok) {
        const field = res.field === 'password' ? 'password' : 'login';
        setErrors({ [field]: res.message });
        (field === 'password' ? passRef : loginRef).current?.focus();
        return;
      }
      router.push(res.user.mustChangePassword ? `/change-password?next=${encodeURIComponent('/agency-dashboard')}` : afterSignIn(next, role(res.user) === 'buyer'));
    });
  };

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[60fr_40fr]">
      <div className="flex min-h-screen flex-col bg-paper">
        <div className="flex h-16 items-center justify-between px-5 sm:px-8 lg:px-12">
          <Wordmark />
          <p className="text-[13px] text-muted">
            New to Emirate08?{' '}
            <Link href="/register" className="link">
              Create account
            </Link>
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-10 sm:px-0">
          {ready && !q.get('stay') && <SignedInNote className="mb-6" />}
          <h1 className="h2 text-[28px] lg:text-[32px]">
            Welcome <em className="f font-normal">Back.</em>
          </h1>
          <p className="mt-2 text-[14px] leading-[1.6] text-muted">
            Sign in to manage your listings, network properties, and professional account.
          </p>

          <form className="mt-8 space-y-4" noValidate onSubmit={onSubmit}>
            <div className={cx('field', errors.login && 'invalid')}>
              <label className="label" htmlFor="l-login">
                Email / Mobile
              </label>
              <input
                ref={loginRef}
                id="l-login"
                name="login"
                className="input"
                autoComplete="username"
                placeholder="name@company.ae or 50 123 4567"
                value={values.login}
                onChange={set('login')}
                {...errProps('l-login', errors.login)}
              />
              <FieldError id="l-login">{errors.login}</FieldError>
            </div>
            <div className={cx('field', errors.password && 'invalid')}>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="l-password">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="mb-1.5 text-xs font-semibold text-ink underline-offset-4 hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput
                ref={passRef}
                id="l-password"
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={values.password}
                onChange={set('password')}
                invalid={!!errors.password}
              />
              <FieldError id="l-password">{errors.password}</FieldError>
            </div>
            <label className="check">
              <input
                type="checkbox"
                id="l-remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me on this device</span>
            </label>
            {notice && (
              <p className="text-[13px] text-muted" role="alert">
                Sign in to continue to your workspace.
              </p>
            )}
            <button ref={submitRef} type="submit" className="btn btn-dark btn-lg w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3 text-2xs tracking-[.12em] text-muted uppercase">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <Link href="/register" className="btn btn-outline btn-lg mt-6 w-full">
            Create Account
          </Link>
        </div>
        <p className="px-5 pb-6 text-center text-2xs text-muted sm:px-8">
          Passwords are securely managed by the account service and never stored as plain text.{' '}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/terms" className="underline">
            Terms
          </Link>
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink-deep lg:block" aria-hidden="true">
        <div className="sticky top-0 h-screen">
          <img
            src="/images/login-architecture.webp"
            alt=""
            className="h-full w-full object-cover"
            width="1600"
            height="1060"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/85 via-ink-deep/10 to-transparent" />
          <div className="absolute inset-x-10 bottom-10 max-w-[380px] text-white">
            <p className="eyebrow text-sage before:bg-sage">Your workspace</p>
            <p className="mt-3 font-display text-[24px] leading-[1.2] font-semibold">
              Listings, network opportunities and your professional profile —{' '}
              <em className="f font-normal text-sage">in one place.</em>
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
