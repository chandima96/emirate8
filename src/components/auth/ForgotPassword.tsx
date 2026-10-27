'use client';

import { authenticateAction } from '@/app/actions';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Wordmark } from '@/components/layout/Wordmark';
import { cx, passwordScore } from '@/lib/utils';
import { PasswordInput, FieldError, errProps } from './authShared';

/** Password reset through Payload Auth. */
export function ForgotPassword() {
  const [stage, setStage] = useState('request');
  const [login, setLogin] = useState('');
  const [entered, setEntered] = useState('');
  const [pw, setPw] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [who, setWho] = useState('');
  const loginRef = useRef(null);
  const headingRef = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stage]);

  const request = async (e) => {
    e.preventDefault();
    if (!login.trim() || !login.includes('@')) {
      setErrors({ login: 'Enter the email address linked to your account.' });
      loginRef.current?.focus();
      return;
    }
    try {
      const result = await authenticateAction({ action: 'forgot-password', email: login.trim() });
      if (!result.ok) throw new Error(result.error || 'Could not request a password reset.');
      setWho(login.trim());
      setErrors({});
      setStage('verify');
    } catch (error) {
      setErrors({ login: error instanceof Error ? error.message : 'Could not request a password reset.' });
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!entered.trim()) er.code = 'Enter the reset token sent to your email.';
    if (pw.length < 8 || passwordScore(pw) < 3)
      er.pw = 'Use 8+ characters with upper and lower case letters and a number.';
    setErrors(er);
    if (er.code || er.pw) return;
    try {
      const result = await authenticateAction({ action: 'reset-password', token: entered.trim(), password: pw });
      if (!result.ok) throw new Error(result.error || 'The reset token is invalid or expired.');
      setErrors({});
      setStage('done');
    } catch (error) {
      setErrors({ code: error instanceof Error ? error.message : 'The reset token is invalid or expired.' });
    }
  };
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="wrap flex h-16 items-center justify-between">
        <Wordmark />
        <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <i className="bi bi-arrow-left h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-10 sm:px-0">
        <div className="card p-6 sm:p-8">
          {stage === 'request' && (
            <form noValidate onSubmit={request}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mist">
                <i className="bi bi-key h-5 w-5 text-ink" aria-hidden="true" />
              </span>
              <h1 className="h3 mt-5" ref={headingRef} tabIndex={-1}>
                Reset your password
              </h1>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">
                Enter the email address or UAE mobile number linked to your account.
              </p>
              <div className={cx('field mt-6', errors.login && 'invalid')}>
                <label className="label" htmlFor="fp-login">
                  Email / Mobile
                </label>
                <input
                  ref={loginRef}
                  id="fp-login"
                  className="input"
                  autoComplete="username"
                  placeholder="name@company.ae"
                  value={login}
                  onChange={(e) => {
                    setLogin(e.target.value);
                    setErrors({});
                  }}
                  {...errProps('fp-login', errors.login)}
                />
                <FieldError id="fp-login">{errors.login}</FieldError>
              </div>
              <button type="submit" className="btn btn-dark btn-lg mt-5 w-full">
                Continue
              </button>
            </form>
          )}
          {stage === 'verify' && (
            <form noValidate onSubmit={verify}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mist">
                <i className="bi bi-shield-check h-5 w-5 text-ink" aria-hidden="true" />
              </span>
              <h2 className="h3 mt-5" ref={headingRef} tabIndex={-1}>
                Enter your reset token
              </h2>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">
                For <span className="font-semibold text-ink">{who}</span>.
              </p>
              <div className={cx('field mt-5', errors.code && 'invalid')}>
                <label className="label" htmlFor="fp-code">
                  Reset token
                </label>
                <input
                  id="fp-code"
                  className="input"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  value={entered}
                  onChange={(e) => {
                    setEntered(e.target.value);
                    setErrors((er) => ({ ...er, code: null }));
                  }}
                  {...errProps('fp-code', errors.code)}
                />
                <FieldError id="fp-code">{errors.code}</FieldError>
              </div>
              <div className={cx('field mt-4', errors.pw && 'invalid')}>
                <label className="label" htmlFor="fp-new">
                  New password
                </label>
                <PasswordInput
                  id="fp-new"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    setErrors((er) => ({ ...er, pw: null }));
                  }}
                  invalid={!!errors.pw}
                />
                <p className="hint">Use upper and lower case letters and a number.</p>
                <FieldError id="fp-new">{errors.pw}</FieldError>
              </div>
              <button type="submit" className="btn btn-dark btn-lg mt-5 w-full">
                Update password
              </button>
            </form>
          )}
          {stage === 'done' && (
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage">
                <i className="bi bi-check-lg h-5 w-5 text-ink" aria-hidden="true" />
              </span>
              <h2 className="h3 mt-5" ref={headingRef} tabIndex={-1}>
                Password updated
              </h2>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">You can now sign in with your new password.</p>
              <Link href="/login" className="btn btn-dark btn-lg mt-6 w-full">
                Sign In
              </Link>
            </div>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-muted">
          Need help? Contact your Emirate08 account manager once support channels open in Phase 1 launch.
        </p>
      </div>
    </div>
  );
}
