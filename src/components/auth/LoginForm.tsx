'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark } from '@/components/layout/Wordmark';
import { useSession } from '@/components/providers/SessionProvider';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { login, role } from '@/lib/store';
import { RX, cx } from '@/lib/utils';
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

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register';
  const authError = q.get('authError');
  const googleError =
    authError === 'google-not-configured'
      ? 'Google sign-in is not configured yet. Please sign in with your email and password.'
      : authError === 'google-email-exists'
        ? 'That email already has an account. Sign in with your email and password instead.'
        : authError?.startsWith('google-')
          ? 'Google sign-in could not be completed. Please try again or use your email and password.'
          : '';

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
    if (!values.login.trim()) er.login = 'Enter your email address.';
    else if (!RX.email.test(values.login.trim())) er.login = 'Enter a valid email address, e.g. name@company.ae.';
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
    <div className="auth-flow lg:grid lg:min-h-screen lg:grid-cols-[60fr_40fr]">
      <div className="flex min-h-screen flex-col bg-paper">
        <div className="auth-fade flex h-16 items-center justify-between px-5 sm:px-8 lg:px-12">
          <Wordmark />
          <p className="text-[13px] text-muted">
            New to Emirate08?{' '}
            <Link href={registerHref} className="link">
              Create account
            </Link>
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-10 sm:px-0">
          {ready && !q.get('stay') && <SignedInNote className="mb-6" />}
          <h1 className="auth-rise h2 text-[28px] lg:text-[32px]" style={{ '--d': 0 } as React.CSSProperties}>
            Welcome <em className="f font-normal">Back.</em>
          </h1>
          <p className="auth-rise mt-2 text-[14px] leading-[1.6] text-muted" style={{ '--d': 1 } as React.CSSProperties}>
            Sign in to manage your listings, network properties, and professional account.
          </p>

          <form className="mt-8 space-y-4" noValidate onSubmit={onSubmit}>
            <div className={cx('field auth-rise', errors.login && 'invalid')} style={{ '--d': 2 } as React.CSSProperties}>
              <label className="label" htmlFor="l-login">
                Email
              </label>
              <input
                ref={loginRef}
                id="l-login"
                name="email"
                type="email"
                className="input"
                autoComplete="email"
                placeholder="name@company.ae"
                value={values.login}
                onChange={set('login')}
                {...errProps('l-login', errors.login)}
              />
              <FieldError id="l-login">{errors.login}</FieldError>
            </div>
            <div className={cx('field auth-rise', errors.password && 'invalid')} style={{ '--d': 3 } as React.CSSProperties}>
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
            <label className="check auth-rise" style={{ '--d': 4 } as React.CSSProperties}>
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
            <button ref={submitRef} type="submit" className="auth-rise auth-press btn btn-dark btn-lg w-full" style={{ '--d': 5 } as React.CSSProperties} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="auth-rise mt-6 flex items-center gap-3 text-2xs tracking-[.12em] text-muted uppercase" style={{ '--d': 6 } as React.CSSProperties}>
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <form action="/api/auth/google" method="get" className="auth-rise mt-6" style={{ '--d': 7 } as React.CSSProperties}>
            <input type="hidden" name="next" value={next || '/'} />
            <button type="submit" className="auth-press btn btn-outline btn-lg w-full">
              <GoogleMark />
              Continue with Google
            </button>
          </form>
          {googleError && (
            <p className="auth-reveal mt-3 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[13px] leading-5 text-danger" role="alert">
              {googleError}
            </p>
          )}
          <p className="auth-rise mt-6 text-center text-sm text-muted" style={{ '--d': 8 } as React.CSSProperties}>
            Don’t have an account?{' '}
            <Link href={registerHref} className="link">
              Create account
            </Link>
          </p>
        </div>
        <p className="auth-fade px-5 pb-6 text-center text-2xs text-muted sm:px-8">
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
      <aside className="relative hidden overflow-clip bg-ink-deep lg:block" aria-hidden="true">
        <div className="sticky top-0 h-screen overflow-hidden">
          <img
            src="/images/login-architecture.webp"
            alt=""
            className="auth-art h-full w-full object-cover"
            width="1600"
            height="1060"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/85 via-ink-deep/10 to-transparent" />
          <div className="auth-rise absolute inset-x-10 bottom-10 max-w-[380px] text-white" style={{ '--d': 5 } as React.CSSProperties}>
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

export function GoogleMark({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
