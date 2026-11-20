'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import { Wordmark } from '@/components/layout/Wordmark';
import { useSession } from '@/components/providers/SessionProvider';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useHydrated } from '@/hooks/useStore';
import { Icon } from '@/components/ui/Icon';
import {
  currentUser,
  startProfessionalCheckout,
  completeProfessionalCheckout,
  emailVerified,
  loadSessionUser,
  sendEmailCode,
  confirmEmailCode,
  plans,
} from '@/lib/store';
import { uploadRegistrationEvidence } from '@/lib/mediaClient';
import { cx, fmtBytes } from '@/lib/utils';
import { FieldError, errProps, SignedInNote, safeNext } from './authShared';
import { QuickBuyerForm } from './QuickBuyerForm';
import { MembershipShowcase } from './MembershipShowcase';
import { StripePayment } from './StripePayment';

/*
 * Registration, modelled on how marketplaces such as Zillow handle professionals:
 *   1. Everyone creates one account (name, email, password — or Google).
 *   2. Everyone confirms their email with a six-digit code (Google sign-ups are already confirmed).
 *   3. Brokers, agencies and developers then upgrade that account at /register/professional:
 *      account type → credentials → membership → Stripe Checkout.
 * A `?type=` on /register (from the "For professionals" pages) carries people straight on to step 3.
 */
const PRO = ['broker', 'agency', 'developer'];
const ACCOUNT_STEPS = ['Your account', 'Confirm email'];
const PRO_STEPS = ['Account type', 'Credentials', 'Membership'];
const DRAFT_KEY = 'e08:pro-draft';
const PERSIST = ['r-brn', 'r-expiry', 'r-agency', 'r-orn', 'r-tl', 'r-agents'];
const TYPES: Array<{ id: string; title: string; icon: string; desc: string }> = [
  { id: 'broker', title: 'Licensed Broker', icon: 'person-check', desc: 'For individual real estate professionals.' },
  { id: 'agency', title: 'Real Estate Agency', icon: 'building', desc: 'For companies managing agents and property portfolios.' },
  { id: 'developer', title: 'Property Developer', icon: 'buildings', desc: 'For developers publishing projects and inventory.' },
];
/* Account-type step: buyers are listed too and simply continue to the site. */
const CHOICES = [
  { id: 'buyer', title: 'Buyer or Tenant', icon: 'house-heart', desc: 'Search, save homes and contact brokers directly.' },
  ...TYPES,
];
/* Left-hand artwork for each account type (crossfades as the choice changes). */
const ART = [
  { id: 'default', src: '/images/register-architecture.webp' },
  { id: 'buyer', src: '/images/dubai-hills.webp' },
  { id: 'broker', src: '/images/dubai-marina.webp' },
  { id: 'agency', src: '/images/business-bay.webp' },
  { id: 'developer', src: '/images/downtown-aerial.webp' },
];
const ArtContext = createContext<(id: string | null) => void>(() => {});
const TYPE_LABEL = { broker: 'broker', agency: 'agency', developer: 'developer' };
const MAX = 10 * 1024 * 1024;

const proType = (t) => (PRO.includes(t) ? t : null);

/** The professional set-up URL, keeping the chosen type and plan. */
function professionalHref(type, plan) {
  const params = new URLSearchParams();
  if (proType(type)) params.set('type', type);
  if (plan) params.set('plan', plan);
  const query = params.toString();
  return `/register/professional${query ? `?${query}` : ''}`;
}

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    return null;
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/* ======================================================================= */
/* Page shell                                                              */
/* ======================================================================= */

export function RegisterWizard({ mode = 'signup' }: { mode?: 'signup' | 'professional' }) {
  const hydrated = useHydrated();
  const { ready } = useSession();
  const q = useSearchParams();
  const qType = proType(q.get('type'));
  const qPlan = q.get('plan');
  const loginNext = mode === 'professional' ? professionalHref(qType, qPlan) : qType ? professionalHref(qType, qPlan) : q.get('next');
  const professional = mode === 'professional' || !!qType;
  const [art, setArt] = useState<string | null>(null);
  const activeArt = ART.some((a) => a.id === art) ? art : 'default';
  // Only fetch artwork that has actually been shown: one image on first paint instead of all five.
  const [mountedArt, setMountedArt] = useState<string[]>([activeArt]);
  const [loadedArt, setLoadedArt] = useState<string[]>([]);
  const [shownArt, setShownArt] = useState<string | null>(null);
  if (!mountedArt.includes(activeArt)) setMountedArt((m) => [...m, activeArt]);
  // Keep the previous image on screen until the new one has loaded, then crossfade.
  if (loadedArt.includes(activeArt) && shownArt !== activeArt) setShownArt(activeArt);
  const markLoaded = (id: string) => setLoadedArt((l) => (l.includes(id) ? l : [...l, id]));
  return (
    <ArtContext.Provider value={setArt}>
    <div className="auth-flow lg:grid lg:min-h-screen lg:grid-cols-[40fr_60fr]">
      <aside className="on-dark relative hidden overflow-clip bg-ink-deep lg:block" aria-label="About Emirate08">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="auth-art absolute inset-0">
            {ART.filter((a) => mountedArt.includes(a.id)).map((a, i) => (
              <img
                key={a.id}
                ref={(el) => {
                  // Already decoded (e.g. loaded before hydration or from cache): onLoad won't fire.
                  if (el?.complete && el.naturalWidth) markLoaded(a.id);
                }}
                onLoad={() => markLoaded(a.id)}
                src={a.src}
                alt=""
                className={cx('reg-art absolute inset-0 h-full w-full object-cover', a.id === shownArt && 'is-active')}
                width="1600"
                height="2400"
                decoding="async"
                fetchPriority={i === 0 ? 'high' : 'low'}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-ink-deep/30 via-ink-deep/20 to-ink-deep/95" />
          <div className="relative flex h-full flex-col p-10 xl:p-12">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 rounded bg-ink-deep/70 px-3 py-2 text-white backdrop-blur"
              aria-label="Emirate08 home"
            >
              <svg className="h-[20px] w-[20px]" viewBox="0 0 24 24" aria-hidden="true">
                <rect width="24" height="24" rx="3" fill="#FFFFFF" fillOpacity=".12" />
                <rect x="5" y="9" width="3" height="10" fill="#A9C0AF" />
                <rect x="10.5" y="4.5" width="3" height="14.5" fill="#FFFFFF" />
                <rect x="16" y="11.5" width="3" height="7.5" fill="#A9C0AF" />
              </svg>
              <span className="font-display text-[16px] font-semibold">
                Emirate<span className="f font-normal">08</span>
              </span>
            </Link>
            <div className="auth-rise mt-auto max-w-[400px]" style={{ '--d': 3 } as React.CSSProperties}>
              <h1 className="font-display text-[30px] leading-[1.12] font-semibold text-white xl:text-[34px]">
                Your Next <em className="f font-normal text-sage">Opportunity</em> Starts Here.
              </h1>
              <p className="mt-4 text-[14px] leading-[1.65] text-[#C9D2CF]">
                {professional
                  ? 'Create your account, confirm your email, then add your professional credentials.'
                  : 'One account to save homes, contact brokers and follow developer launches.'}
              </p>
              <ul className="mt-7 space-y-3 border-t border-white/15 pt-6 text-[13px] text-white">
                {(professional
                  ? [
                      ['person-vcard', 'Professional profile'],
                      ['buildings', 'Property management'],
                      ['diagram-3', 'Broker network access'],
                    ]
                  : [
                      ['heart', 'Saved homes and searches'],
                      ['chat-dots', 'Contact brokers directly'],
                      ['buildings', 'Developer project updates'],
                    ]
                ).map(([icon, label]) => (
                  <li key={label} className="flex items-center gap-3">
                    <i className={`bi bi-${icon} h-4 w-4 text-sage`} aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col bg-paper">
        <div className="flex h-16 items-center justify-between px-5 sm:px-8 lg:px-12">
          <span className="lg:hidden">
            <Wordmark />
          </span>
          <Link href="/" className="hidden items-center gap-1.5 text-[13px] text-muted hover:text-ink lg:inline-flex">
            <i className="bi bi-arrow-left h-4 w-4" aria-hidden="true" />
            Back to website
          </Link>
          <p className="text-[13px] text-muted">
            Have an account?{' '}
            <Link href={loginNext ? `/login?next=${encodeURIComponent(loginNext)}` : '/login'} className="link">
              Sign in
            </Link>
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-[600px] flex-1 flex-col px-5 pb-10 sm:px-8">
          {hydrated && (ready || mode === 'professional') ? (
            mode === 'professional' ? (
              <UpgradeFlow
                qType={qType}
                qPlan={qPlan}
                qCheckout={q.get('checkout')}
                qSession={q.get('session_id')}
                next={safeNext(q.get('next'))}
              />
            ) : (
              <SignupFlow qType={qType} qPlan={qPlan} next={safeNext(q.get('next'))} stay={!!q.get('stay')} />
            )
          ) : (
            <div className="min-h-[480px]" />
          )}
        </div>
      </div>
    </div>
    </ArtContext.Provider>
  );
}

/* ======================================================================= */
/* Progress                                                                */
/* ======================================================================= */

function Progress({ names, current }: { names: string[]; current: number }) {
  return (
    <div className="pt-2 lg:pt-6">
      <div className="flex items-center justify-between text-2xs font-semibold tracking-[.12em] text-muted uppercase">
        <span>
          Step {current} of {names.length}
        </span>
        <span>{names[current - 1]}</span>
      </div>
      <div className="meter mt-2.5">
        <span style={{ width: (current / names.length) * 100 + '%' }} />
      </div>
      <ol
        className="mt-4 hidden gap-2 sm:grid"
        style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}
        aria-label="Registration steps"
      >
        {names.map((name, i) => {
          const n = i + 1;
          return (
            <li
              key={name}
              className={cx('step flex items-center gap-2', n === current && 'is-current', n < current && 'is-done')}
              aria-current={n === current ? 'step' : undefined}
            >
              <span className="step-dot">{n < current ? <Icon name="check-lg" className="h-3 w-3" /> : n}</span>
              <span className="step-label">{name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ======================================================================= */
/* /register — create the account and confirm the email                    */
/* ======================================================================= */

function SignupFlow({ qType, qPlan, next, stay }) {
  const router = useRouter();
  const [startUser] = useState(() => currentUser());
  // A signed-in buyer who has not confirmed their email picks up at the code step.
  const [stage, setStage] = useState<'details' | 'verify'>(() =>
    startUser && startUser.type === 'buyer' && !emailVerified(startUser) ? 'verify' : 'details',
  );
  const proHref = professionalHref(qType, qPlan);
  const names = qType ? [...ACCOUNT_STEPS, ...PRO_STEPS] : ACCOUNT_STEPS;

  // Already signed in and confirmed, arriving from a professional link: go straight to the upgrade.
  useEffect(() => {
    if (qType && startUser && startUser.type === 'buyer' && emailVerified(startUser)) router.replace(proHref);
  }, [qType, startUser, proHref, router]);

  // Everyone registers as a buyer, then picks an account type (buyer → home, professional → set-up).
  const confirmed = () => {
    if (qType) router.push(proHref);
    else router.push(next ? `/register/professional?${new URLSearchParams({ next })}` : '/register/professional');
  };

  return (
    <section>
      {!stay && stage === 'details' && <SignedInNote className="mt-4" />}
      <Progress names={names} current={stage === 'verify' ? 2 : 1} />
      {stage === 'details' ? (
        <div key="details" className="auth-step mt-8 lg:mt-10">
          <QuickBuyerForm
            heading={
              qType ? (
                <>
                  Start With Your <em className="f font-normal">Account.</em>
                </>
              ) : undefined
            }
            intro={
              qType
                ? `Create your Emirate08 account first. After confirming your email you'll add your ${TYPE_LABEL[qType]} credentials and choose a membership.`
                : undefined
            }
            submitLabel={qType ? 'Create account & continue' : 'Create account'}
            googleNext={qType ? proHref : next || undefined}
            onSuccess={() => setStage('verify')}
          />
          {!qType && (
            <p className="mt-6 rounded-lg border border-line bg-white px-4 py-3 text-[13px] leading-[1.6] text-muted">
              <i className="bi bi-briefcase mr-1.5 text-ink" aria-hidden="true" />
              Broker, agency or developer? Create your account here first — after confirming your email you can
              choose your account type and add your professional credentials.
            </p>
          )}
        </div>
      ) : (
        <div key="verify" className="auth-step mt-8 lg:mt-10">
          <EmailConfirm onConfirmed={confirmed} />
        </div>
      )}
    </section>
  );
}

/* ======================================================================= */
/* Email confirmation — the same step for every account type               */
/* ======================================================================= */

function EmailConfirm({ onConfirmed }) {
  const { toast } = useFeedback();
  const [email, setEmail] = useState(() => currentUser()?.email || '');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(true);
  const [secs, setSecs] = useState(0);
  const [done, setDone] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sentOnce = useRef(false);

  const send = async (manual = false) => {
    setSending(true);
    setError('');
    const result = await sendEmailCode();
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.alreadyVerified) {
      setDone(true);
      return;
    }
    if (result.email) setEmail(result.email);
    setDigits(['', '', '', '', '', '']);
    setSecs(30);
    if (manual) toast('A new code is on its way.', { icon: 'envelope' });
    setTimeout(() => refs.current[0]?.focus(), 60);
  };

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (sentOnce.current) return;
    sentOnce.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (secs <= 0) return;
    const timer = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secs]);

  const check = async (arr: string[]) => {
    const entered = arr.join('');
    if (entered.length < 6) {
      setError('Enter all six digits.');
      refs.current[arr.findIndex((d) => !d)]?.focus();
      return;
    }
    setBusy(true);
    const result = await confirmEmailCode(entered);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
      return;
    }
    setDone(true);
  };

  const fill = (str: string, start: number) => {
    const arr = [...digits];
    str
      .slice(0, 6 - start)
      .split('')
      .forEach((d, k) => (arr[start + k] = d));
    setDigits(arr);
    refs.current[Math.min(5, start + str.length - 1)]?.focus();
    if (arr.every(Boolean)) void check(arr);
  };

  const onInput = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '');
    if (d.length > 1) return fill(d, i);
    const arr = [...digits];
    arr[i] = d;
    setDigits(arr);
    setError('');
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (arr.every(Boolean)) void check(arr);
  };

  // Once the code is confirmed, move straight on — no intermediate "Email confirmed" screen.
  useEffect(() => {
    if (done) onConfirmed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (done) return null;

  return (
    <div>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mist text-ink">
        <i className="bi bi-envelope h-5 w-5" aria-hidden="true" />
      </span>
      <h2 ref={headingRef} className="h2 mt-6 text-[26px] lg:text-[30px]" tabIndex={-1} data-step-heading>
        Confirm Your <em className="f font-normal">Email.</em>
      </h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-muted">
        {sending ? 'Sending a six-digit code to ' : 'We sent a six-digit code to '}
        <span className="font-semibold text-ink">{email || 'your email'}</span>. Enter it below to confirm it&apos;s you.
      </p>
      <form
        className="mt-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check(digits);
        }}
      >
        <fieldset disabled={sending || busy}>
          <legend className="sr-only">Six-digit code</legend>
          <div className="flex max-w-[380px] justify-between gap-1.5 sm:gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={cx('otp-input', error && 'border-danger')}
                inputMode="numeric"
                maxLength={1}
                autoComplete={i === 0 ? 'one-time-code' : undefined}
                aria-label={'Digit ' + (i + 1)}
                value={d}
                onChange={(e) => onInput(i, e.target.value)}
                onFocus={(e) => e.target.select()}
                onPaste={(e) => {
                  e.preventDefault();
                  fill(e.clipboardData.getData('text').replace(/\D/g, ''), 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !d && i > 0) {
                    e.preventDefault();
                    const arr = [...digits];
                    arr[i - 1] = '';
                    setDigits(arr);
                    refs.current[i - 1]?.focus();
                  }
                  if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
                  if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
                }}
              />
            ))}
          </div>
        </fieldset>
        <p className="mt-2 min-h-[18px] text-xs text-danger" role="alert">
          {error}
        </p>
        <p className="mt-2 text-xs text-muted">
          Didn&apos;t get it? Check your spam folder, or{' '}
          <button
            type="button"
            className="font-semibold text-ink underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
            disabled={secs > 0 || sending}
            onClick={() => void send(true)}
          >
            {secs > 0 ? `resend in ${secs}s` : 'send a new code'}
          </button>
          .
        </p>
        <div className="mt-8 flex border-t border-line pt-5">
          <button type="submit" className="auth-press btn btn-dark btn-lg ml-auto" disabled={sending || busy} aria-busy={busy}>
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Confirming
              </>
            ) : (
              <>
                Confirm email
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ======================================================================= */
/* /register/professional — upgrade a confirmed account                    */
/* ======================================================================= */

function UpgradeFlow({ qType, qPlan, qCheckout, qSession, next }) {
  const router = useRouter();
  const { ready } = useSession();
  // Start from the light session request (fast) instead of waiting for the whole store to load.
  const [user, setUser] = useState(() => currentUser());
  const [known, setKnown] = useState(() => !!currentUser());
  const [confirmedNow, setVerified] = useState(false);
  const verified = confirmedNow || emailVerified(user);
  useEffect(() => {
    if (known) return;
    let alive = true;
    loadSessionUser()
      .then((u) => alive && setUser((current) => current || u))
      .catch(() => {})
      .finally(() => alive && setKnown(true));
    return () => {
      alive = false;
    };
  }, [known]);
  // Paid through the embedded checkout (session id), or back from Stripe's hosted page.
  const [paidSession, setPaidSession] = useState<string | null>(null);
  const returningFromStripe = qCheckout === 'success' || !!paidSession;

  // Not signed in: create the account first, then come back here.
  useEffect(() => {
    if (known && !user) router.replace(`/register?${new URLSearchParams({ type: qType || 'broker', ...(qPlan ? { plan: qPlan } : {}) })}`);
  }, [known, user, qType, qPlan, router]);

  // Already a professional (and not just back from paying): nothing to set up, go home.
  const alreadyPro = !!user && user.type !== 'buyer' && !returningFromStripe;
  useEffect(() => {
    if (alreadyPro) router.replace('/');
  }, [alreadyPro, router]);

  if (!user) return <div className="min-h-[480px]" />;

  if (user.type !== 'buyer') {
    return returningFromStripe ? <ProSuccess paid /> : <div className="min-h-[480px]" />;
  }

  if (returningFromStripe) {
    // Confirming updates the local store, so wait until it has loaded.
    if (!ready) return <div className="min-h-[480px]" />;
    return <ConfirmPayment sessionId={paidSession || qSession} onUpgraded={setUser} />;
  }

  if (!verified) {
    return (
      <section>
        <Progress names={[...ACCOUNT_STEPS, ...PRO_STEPS]} current={2} />
        <div className="auth-step mt-8 lg:mt-10">
          <EmailConfirm onConfirmed={() => setVerified(true)} />
        </div>
      </section>
    );
  }

  return (
    <ProfessionalWizard
      user={user}
      qType={qType}
      qPlan={qPlan}
      cancelled={qCheckout === 'cancelled'}
      onUpgraded={setUser}
      onPaid={setPaidSession}
      next={next}
    />
  );
}

/** Back from Stripe Checkout: confirm the payment, retrying briefly while Stripe finishes. */
function ConfirmPayment({ sessionId, onUpgraded }) {
  const [state, setState] = useState<{ status: 'checking' | 'error'; message?: string }>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async (tries: number) => {
      const result = await completeProfessionalCheckout(sessionId);
      if (!alive) return;
      if (result.ok) {
        clearDraft();
        onUpgraded(result.user);
        return;
      }
      if (result.pending && tries < 15) {
        timer = setTimeout(() => run(tries + 1), 2000);
        return;
      }
      setState({ status: 'error', message: result.message });
    };
    void run(0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sessionId, attempt, onUpgraded]);

  if (state.status === 'error') {
    return (
      <section className="pt-6 lg:pt-14" aria-live="polite">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warn-soft text-warn">
          <i className="bi bi-exclamation-triangle h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="h2 mt-6">
          We Couldn&apos;t Confirm <em className="f font-normal">Your Payment.</em>
        </h2>
        <p className="mt-2 max-w-[480px] text-[14px] leading-[1.65] text-muted">
          {state.message || 'Something went wrong while confirming your payment.'} If you were charged, your account
          will be upgraded automatically within a few minutes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-dark btn-lg"
            onClick={() => {
              setState({ status: 'checking' });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
          <Link href="/help" className="btn btn-outline btn-lg">
            Contact support
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center text-center" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden="true" />
      <h2 className="h3 mt-6">Confirming your payment…</h2>
      <p className="mt-2 text-[14px] text-muted">This only takes a moment. Please don&apos;t close this page.</p>
    </section>
  );
}

let stripeJs: Promise<StripeJs | null> | null = null;
function getStripeJs() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripeJs ??= loadStripe(key);
  return stripeJs;
}

/** Payment step: Stripe Elements styled with the site UI (see StripePayment) — the buyer never leaves the site. */
function EmbeddedPayment({ names, clientSecret, onComplete, onBack }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  return (
    <section>
      <Progress names={names} current={names.length} />
      <div className="auth-step mt-8 lg:mt-10">
        <h2 ref={ref} className="h2 text-[26px] lg:text-[30px]" tabIndex={-1} data-step-heading>
          Secure <em className="f font-normal">Payment.</em>
        </h2>
        <p className="mt-2 flex items-center gap-2 text-[14px] text-muted">
          <i className="bi bi-lock h-4 w-4 text-ink" aria-hidden="true" />
          Payments are processed securely by Stripe. Your card details never touch our servers.
        </p>
        <StripePayment stripe={getStripeJs()} clientSecret={clientSecret} onComplete={onComplete} onBack={onBack} />
      </div>
    </section>
  );
}

const REDIRECT_MS = 4000;

/** Upgrade done: animated confirmation, then on to the home page. */
function ProSuccess({ paid = false }: { paid?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const timer = setTimeout(() => router.replace('/'), REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <section
      className="flex flex-col items-center pt-10 text-center lg:pt-20"
      tabIndex={-1}
      ref={ref}
      aria-labelledby="success-title"
      aria-live="polite"
    >
      <svg className="pay-done h-24 w-24" viewBox="0 0 96 96" aria-hidden="true">
        <circle className="pay-done-ring" cx="48" cy="48" r="44" />
        <path className="pay-done-check" d="M30 49.5 42.5 62 66 36" />
      </svg>
      <h2 id="success-title" className="auth-rise h2 mt-8" style={{ '--d': 6 } as React.CSSProperties}>
        {paid ? (
          <>
            Payment <em className="f font-normal">Completed.</em>
          </>
        ) : (
          <>
            Welcome to <em className="f font-normal">Emirate08 Pro.</em>
          </>
        )}
      </h2>
      <p className="auth-rise mt-2 max-w-[420px] text-[14px] leading-[1.65] text-muted" style={{ '--d': 7 } as React.CSSProperties}>
        Your account is now a professional account. We&apos;ve emailed you a confirmation — your credentials will be
        reviewed shortly.
      </p>
      <div className="auth-rise mt-8 w-full max-w-[260px]" style={{ '--d': 8 } as React.CSSProperties}>
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <span className="pay-done-bar block h-full bg-ink" style={{ animationDuration: `${REDIRECT_MS}ms` }} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Taking you to the home page…{' '}
          <Link href="/" replace className="link">
            Go now
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Draft first, then ?type= and ?plan=. A type from the link skips the type step. */
function initialState(qType, qPlan, pending) {
  const st = { step: 1, type: null, plan: null, planTouched: false, v: {} };
  const draft = loadDraft();
  if (draft) {
    Object.keys(draft.v || {}).forEach((id) => {
      if (PERSIST.includes(id) && draft.v[id]) st.v[id] = draft.v[id];
    });
    st.planTouched = !!draft.planTouched;
    if (proType(draft.type)) st.type = draft.type;
    if (draft.plan) st.plan = draft.plan;
  } else if (pending && proType(pending.type)) {
    // Back from a cancelled checkout on another tab or device: use the details saved with it.
    st.type = pending.type;
    st.plan = pending.plan;
    st.planTouched = true;
  }
  if (qType) st.type = qType;
  if (qPlan && plans()[qPlan] && (!st.type || plans()[qPlan].roleAudience === st.type)) {
    st.plan = qPlan;
    st.planTouched = true;
  }
  if (st.type && plans()[st.plan]?.roleAudience !== st.type) {
    st.plan = `${st.type}-bronze`;
    st.planTouched = false;
  }
  st.step = draft?.step >= 2 && st.type ? Math.min(draft.step, 3) : qType ? 2 : 1;
  return st;
}

/** Documents uploaded before a cancelled checkout, so they need not be uploaded again. */
function pendingFiles(pending, type) {
  const creds = pending && pending.type === type ? pending.credentials || {} : {};
  const pick = (f) => (f && f.url ? { name: f.name || 'Uploaded document', size: f.size, type: f.type, url: f.url, id: f.id } : null);
  return { cardFile: pick(creds.cardFile), licenceFile: pick(creds.licenceFile), developerLogo: pick(creds.developerLogo) };
}

function ProfessionalWizard({ user, qType, qPlan, cancelled, onUpgraded, onPaid, next }) {
  const router = useRouter();
  const setArt = useContext(ArtContext);
  const [checkout, setCheckout] = useState<{ clientSecret: string; sessionId: string } | null>(null);
  const pending = user.pendingUpgrade || null;
  const [init] = useState(() => initialState(qType, qPlan, pending));
  const [step, setStep] = useState(cancelled && init.type ? 3 : init.step);
  const [type, setTypeState] = useState(init.type);
  const planCards = Object.values(plans())
    .filter((item) => item.roleAudience === type)
    .map((item) => ({
      id: item.id,
      desc: [
        item.audience,
        item.seats ? `${item.seats} seat${item.seats === 1 ? '' : 's'}` : '',
        item.listings ? `${item.listings} active listings` : '',
        item.selections ? `${item.selections} selections` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    }));
  const [plan, setPlanState] = useState(init.plan);
  const [planTouched, setPlanTouched] = useState(init.planTouched);
  const [v, setV] = useState(() => ({ ...init.v }));
  const [files, setFiles] = useState(() => pendingFiles(pending, init.type));
  const [checks, setChecks] = useState({ 'r-terms': false, 'r-privacy': false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [typeError, setTypeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showCancelled, setShowCancelled] = useState(!!cancelled);
  const [success, setSuccess] = useState(false);
  const doneRef = useRef(false);
  const focusStep = useRef(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const fieldsetRefs = useRef({});
  const formRef = useRef<HTMLFormElement>(null);
  /** Full-screen plan showcase; holds the rect it grows out of. */
  const [showcase, setShowcase] = useState<{ from: DOMRect | null } | null>(null);
  const openShowcase = (el?: Element | null) => setShowcase({ from: el?.getBoundingClientRect() ?? null });
  const showcasePlans = Object.values(plans())
    .filter((item) => item.roleAudience === type)
    .sort((a, b) => ((a as { sortOrder?: number }).sortOrder ?? 0) - ((b as { sortOrder?: number }).sortOrder ?? 0));

  const selectedPlan = plans()[plan];
  const price = typeof selectedPlan?.price === 'number' && selectedPlan.price > 0 ? selectedPlan.price : null;

  /* ---------- Draft persistence (no files) ---------- */
  useEffect(() => {
    if (doneRef.current) return;
    const d = { step, type, plan, planTouched, v: {} };
    PERSIST.forEach((id) => (d.v[id] = v[id] || ''));
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, [step, type, plan, planTouched, v]);

  useEffect(() => {
    const f = fieldsetRefs.current[step];
    if (focusStep.current) {
      focusStep.current = false;
      // The plan showcase owns focus while it is open (it returns focus to the chosen plan on close).
      if (!showcase) f?.querySelector('[data-step-heading]')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Runs on step changes only; `showcase` is read as of that render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const val = (id) => String(v[id] || '').trim();
  const clearErr = (id) => setErrors((e) => (e[id] ? { ...e, [id]: null } : e));
  const bind = (id) => ({
    id,
    value: v[id] || '',
    onChange: (e) => {
      const value = e.target.value;
      setV((s) => ({ ...s, [id]: value }));
      clearErr(id);
    },
    ...errProps(id, errors[id]),
  });
  const bindCheck = (id) => ({
    id,
    type: 'checkbox',
    checked: !!checks[id],
    onChange: (e) => {
      const c = e.target.checked;
      setChecks((s) => ({ ...s, [id]: c }));
      clearErr(id);
    },
    ...errProps(id, errors[id]),
  });

  useEffect(() => {
    setArt(type);
  }, [type, setArt]);
  useEffect(() => () => setArt(null), [setArt]);

  const setType = (t) => {
    setTypeState(t);
    setTypeError(false);
    if (t === 'buyer') return;
    setPlanState(`${t}-bronze`);
    setPlanTouched(false);
    setFiles(pendingFiles(pending, t));
  };
  const setPlan = (p) => {
    setPlanState(p);
    setPlanTouched(true);
  };
  const radioKeys = (items, setter) => (e) => {
    const els = [...e.currentTarget.querySelectorAll('[role=radio]')];
    const i = els.indexOf(document.activeElement);
    if (i < 0) return;
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const n = (i + d + els.length) % els.length;
    els[n].focus();
    setter(items[n].id);
  };

  /* ---------- Validation per step ---------- */
  const validate = (n) => {
    const er: Record<string, string> = {};
    const order = [];
    const fail = (id, msg) => {
      er[id] = msg;
      order.push(id);
    };
    if (n === 1) {
      if (!type) {
        setTypeError(true);
        (document.querySelector('[data-type]') as HTMLElement)?.focus();
        return false;
      }
      setTypeError(false);
    }
    if (n === 2) {
      if (type === 'agency') {
        if (val('r-agency').length < 2) fail('r-agency', 'Enter the registered agency name.');
        if (!/^\d{3,8}$/.test(val('r-orn'))) fail('r-orn', 'Enter a valid ORN (numbers only).');
        if (!/^[A-Za-z0-9-]{4,15}$/.test(val('r-tl'))) fail('r-tl', 'Enter the trade licence number.');
        if (!files.licenceFile) fail('r-tlfile', 'Upload a copy of your trade licence.');
        if (val('r-agents') && (+val('r-agents') < 1 || +val('r-agents') > 5000))
          fail('r-agents', 'Enter a number between 1 and 5,000.');
      } else if (type === 'broker') {
        if (!/^\d{3,8}$/.test(val('r-brn'))) fail('r-brn', 'Enter your BRN (numbers only).');
        if (!files.cardFile) fail('r-card', 'Upload a copy of your RERA card.');
        const exp = val('r-expiry');
        if (!exp) fail('r-expiry', 'Enter the expiry date shown on your card.');
        else if (new Date(exp) <= new Date()) fail('r-expiry', 'This card has expired — renew it before registering.');
      }
    }
    if (n === 3) {
      if (!checks['r-terms']) fail('r-terms', 'Please accept the Terms of Service.');
      if (!checks['r-privacy']) fail('r-privacy', 'Please confirm the Privacy Policy and PDPL consent.');
    }
    const stepFields = {
      1: [],
      2: ['r-brn', 'r-card', 'r-expiry', 'r-agency', 'r-orn', 'r-tl', 'r-tlfile', 'r-agents'],
      3: ['r-terms', 'r-privacy'],
    }[n];
    setErrors((current) => {
      const next = { ...current };
      stepFields.forEach((id) => delete next[id]);
      return { ...next, ...er };
    });
    if (order.length) document.getElementById(order[0])?.focus();
    return !order.length;
  };

  const go = (n) => {
    focusStep.current = true;
    setDir(n < step ? -1 : 1);
    setStep(n);
  };

  /* Upload the documents, save the details, then pay with Stripe (or finish straight away for unpriced plans). */
  const submitUpgrade = async () => {
    if (busy) return;
    // Credentials can be missing after returning from a cancelled checkout in a new session.
    if (!validate(2)) {
      go(2);
      return;
    }
    setBusy(true);
    setSubmitError('');
    setShowCancelled(false);
    const creds =
      type === 'agency'
        ? {
            agencyName: val('r-agency'),
            orn: val('r-orn'),
            tradeLicence: val('r-tl'),
            licenceFile: files.licenceFile,
            agents: val('r-agents'),
          }
        : type === 'developer'
          ? { developerName: user.name, developerLogo: files.developerLogo }
          : { brn: val('r-brn'), expiry: val('r-expiry'), cardFile: files.cardFile };
    try {
      for (const key of ['cardFile', 'licenceFile', 'developerLogo']) {
        const file = creds[key];
        if (file?.file) creds[key] = await uploadRegistrationEvidence(file.file, file.name);
      }
    } catch (error) {
      setBusy(false);
      go(2);
      const field = type === 'agency' ? 'r-tlfile' : type === 'developer' ? 'r-developer-logo' : 'r-card';
      setErrors((er) => ({ ...er, [field]: error instanceof Error ? error.message : 'Could not upload your document.' }));
      return;
    }
    // Keep the uploaded copies so a cancelled checkout doesn't ask for them again.
    setFiles((current) => ({
      cardFile: creds.cardFile || current.cardFile,
      licenceFile: creds.licenceFile || current.licenceFile,
      developerLogo: creds.developerLogo || current.developerLogo,
    }));

    const res = await startProfessionalCheckout({ type, plan: plan || `${type}-bronze`, credentials: creds });
    if (!res.ok) {
      setBusy(false);
      setSubmitError(res.message || 'Could not set up your professional account. Please try again.');
      return;
    }
    if (res.clientSecret) {
      setBusy(false);
      setCheckout({ clientSecret: res.clientSecret, sessionId: res.sessionId });
      return;
    }
    if (res.url) {
      window.location.assign(res.url);
      return;
    }
    setBusy(false);
    doneRef.current = true;
    clearDraft();
    setSuccess(true);
    onUpgraded(res.user);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (busy || !validate(step)) return;
    if (step === 1 && type === 'buyer') {
      doneRef.current = true;
      clearDraft();
      router.push(next || '/');
      return;
    }
    if (step < 3) {
      // Reaching the membership step grows the full-screen plan showcase out of the form.
      if (step === 2) openShowcase(formRef.current);
      go(step + 1);
      return;
    }
    void submitUpgrade();
  };

  const credKind = type === 'agency' ? 'agency' : type === 'developer' ? 'developer' : 'broker';
  const names = PRO_STEPS;

  if (success) return <ProSuccess />;
  if (checkout) {
    return (
      <EmbeddedPayment
        names={names}
        clientSecret={checkout.clientSecret}
        onComplete={() => onPaid(checkout.sessionId)}
        onBack={() => setCheckout(null)}
      />
    );
  }

  return (
    <section>
      <Progress names={names} current={step} />

      {showCancelled && (
        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-line bg-white px-4 py-3 text-[13px] leading-[1.55] text-muted" role="status">
          <i className="bi bi-info-circle mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
          <p>
            <span className="font-semibold text-ink">Payment cancelled.</span> You haven&apos;t been charged. Your details
            are saved — continue when you&apos;re ready.
          </p>
        </div>
      )}

      {showcase && (
        <MembershipShowcase
          plans={showcasePlans}
          selected={plan}
          onSelect={setPlan}
          originRect={showcase.from}
          targetRect={(id) => formRef.current?.querySelector(`[data-plan="${id}"]`)?.getBoundingClientRect() ?? null}
          audienceLabel={TYPE_LABEL[type] || 'professional'}
          onClose={() => {
            setShowcase(null);
            requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[data-plan="${plan}"]`)?.focus());
          }}
        />
      )}

      <form
        ref={formRef}
        className="mt-8 lg:mt-10"
        style={{ '--auth-dir': dir } as React.CSSProperties}
        noValidate
        autoComplete="on"
        onSubmit={onSubmit}
      >
        {/* STEP 1: account type */}
        <fieldset
          ref={(el) => {
            fieldsetRefs.current[1] = el;
          }}
          hidden={step !== 1}
          className="auth-step"
        >
          <legend className="sr-only">Account type</legend>
          <h2 className="h2 text-[26px] lg:text-[30px]" tabIndex={-1} data-step-heading>
            Choose Your <em className="f font-normal">Account Type.</em>
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            Signed in as <span className="font-semibold text-ink">{user.email}</span>. Tell us how you&apos;ll use
            Emirate08.
          </p>
          <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Account type" onKeyDown={radioKeys(CHOICES, setType)}>
            {CHOICES.map((t, i) => [
              i === 1 && (
                <div key="divider" className="flex items-center gap-3 pt-3 pb-1 text-2xs font-semibold tracking-[.12em] text-muted uppercase">
                  <span className="h-px flex-1 bg-line" />
                  Professional accounts
                  <span className="h-px flex-1 bg-line" />
                </div>
              ),
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={type === t.id}
                tabIndex={type === t.id || (!type && t.id === 'buyer') ? 0 : -1}
                className="option-card auth-rise"
                style={{ '--d': i + 1 } as React.CSSProperties}
                data-type={t.id}
                onClick={() => setType(t.id)}
              >
                <span className="radio-dot" />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-[16px] font-semibold text-ink">{t.title}</span>
                    <i className={`bi bi-${t.icon} h-5 w-5 text-muted`} aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-[13px] text-muted">{t.desc}</span>
                </span>
              </button>,
            ])}
          </div>
          {typeError && (
            <p className="mt-3 text-xs text-danger" role="alert">
              <i className="bi bi-exclamation-circle mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Choose an account type to continue.
            </p>
          )}
        </fieldset>

        {/* STEP 2: credentials */}
        <fieldset
          ref={(el) => {
            fieldsetRefs.current[2] = el;
          }}
          hidden={step !== 2}
          className="auth-step"
        >
          <legend className="sr-only">Professional credentials</legend>
          <h2 className="h2 text-[26px] lg:text-[30px]" tabIndex={-1} data-step-heading>
            Your Professional <em className="f font-normal">Details.</em>
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            Provide the information required to review your real estate credentials.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2" hidden={credKind !== 'broker'}>
            <TextField
              id="r-brn"
              label="RERA BRN"
              hint="The number printed on your RERA broker card."
              error={errors['r-brn']}
            >
              <input
                name="brn"
                className="input"
                inputMode="numeric"
                placeholder="Broker Registration Number"
                {...bind('r-brn')}
              />
            </TextField>
            <TextField id="r-expiry" label="RERA Card Expiry Date" error={errors['r-expiry']}>
              <input name="expiry" type="date" className="input" {...bind('r-expiry')} />
            </TextField>
            <UploadField
              id="r-card"
              labelId="lbl-card"
              label="RERA Card Upload"
              title="Upload your RERA card"
              file={files.cardFile}
              error={errors['r-card']}
              onError={(msg) => setErrors((e) => ({ ...e, 'r-card': msg }))}
              onFile={(f) => {
                setFiles((s) => ({ ...s, cardFile: f }));
                clearErr('r-card');
              }}
            />
          </div>
          <div className="mt-6 rounded-lg border border-line bg-mist p-4" hidden={credKind !== 'developer'}>
            <p className="text-sm font-semibold text-ink">Developer profile</p>
            <p className="mt-1 text-xs leading-[1.55] text-muted">
              Add your company logo so brokers can recognise your developer card. You can skip this and use the default
              logo.
            </p>
            <div className="mt-4">
              <UploadField
                id="r-developer-logo"
                labelId="lbl-developer-logo"
                label="Developer logo"
                title="Upload your company logo"
                file={files.developerLogo}
                error={errors['r-developer-logo']}
                imageOnly
                onError={(msg) => setErrors((e) => ({ ...e, 'r-developer-logo': msg }))}
                onFile={(f) => {
                  setFiles((s) => ({ ...s, developerLogo: f }));
                  clearErr('r-developer-logo');
                }}
              />
            </div>
            <p className="mt-2 text-2xs text-muted">Optional · JPG or PNG · up to 10 MB</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2" hidden={credKind !== 'agency'}>
            <TextField id="r-agency" label="Agency Name" className="sm:col-span-2" error={errors['r-agency']}>
              <input
                name="agencyName"
                className="input"
                autoComplete="organization"
                placeholder="Registered company name"
                {...bind('r-agency')}
              />
            </TextField>
            <TextField id="r-orn" label="ORN" error={errors['r-orn']}>
              <input
                name="orn"
                className="input"
                inputMode="numeric"
                placeholder="Office Registration Number"
                {...bind('r-orn')}
              />
            </TextField>
            <TextField id="r-tl" label="Trade Licence Number" error={errors['r-tl']}>
              <input name="tradeLicence" className="input" placeholder="e.g. 1234567" {...bind('r-tl')} />
            </TextField>
            <UploadField
              id="r-tlfile"
              labelId="lbl-tl"
              label="Trade Licence Upload"
              title="Upload your trade licence"
              file={files.licenceFile}
              error={errors['r-tlfile']}
              onError={(msg) => setErrors((e) => ({ ...e, 'r-tlfile': msg }))}
              onFile={(f) => {
                setFiles((s) => ({ ...s, licenceFile: f }));
                clearErr('r-tlfile');
              }}
            />
            <TextField id="r-agents" label="Number of Agents" optional error={errors['r-agents']}>
              <input
                name="agents"
                type="number"
                min="1"
                max="5000"
                className="input"
                placeholder="e.g. 8"
                {...bind('r-agents')}
              />
            </TextField>
          </div>
          <p className="mt-5 flex items-start gap-2 rounded-lg bg-mist px-3.5 py-3 text-xs leading-[1.55] text-muted">
            <i className="bi bi-lock mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" aria-hidden="true" />
            Your documents are stored securely and are only seen by the Emirate08 verification team.
          </p>
        </fieldset>

        {/* STEP 3: membership */}
        <fieldset
          ref={(el) => {
            fieldsetRefs.current[3] = el;
          }}
          hidden={step !== 3}
          className="auth-step"
        >
          <legend className="sr-only">Membership and consent</legend>
          <h2 className="h2 text-[26px] lg:text-[30px]" tabIndex={-1} data-step-heading>
            Choose Your <em className="f font-normal">Membership.</em>
          </h2>
          <p className="mt-2 text-[14px] text-muted">Select the plan that supports your brokerage needs.</p>
          <div
            className="mt-6 grid gap-3"
            role="radiogroup"
            aria-label="Membership plan"
            onKeyDown={radioKeys(planCards, setPlan)}
          >
            {planCards.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={plan === p.id}
                tabIndex={plan === p.id ? 0 : -1}
                className="option-card auth-rise"
                style={{ '--d': i + 1 } as React.CSSProperties}
                data-plan={p.id}
                onClick={() => setPlan(p.id)}
              >
                <span className="radio-dot" />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-[16px] font-semibold text-ink">{plans()[p.id].name}</span>
                    <span className="text-xs font-semibold text-muted">
                      {plans()[p.id].price == null
                        ? 'Pricing to be confirmed'
                        : `AED ${plans()[p.id].price.toLocaleString()} / month`}
                    </span>
                  </span>
                  <span className="mt-1 block text-[13px] text-muted">{p.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="auth-press auth-rise mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-white/60 px-4 py-3 text-[13px] font-semibold text-ink hover:border-ink"
            style={{ '--d': planCards.length + 1 } as React.CSSProperties}
            onClick={(e) => openShowcase(e.currentTarget)}
          >
            <i className="bi bi-arrows-fullscreen" aria-hidden="true" />
            Compare plans in detail
          </button>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <i className="bi bi-calendar-event h-3.5 w-3.5 text-ink" aria-hidden="true" />
            {price
              ? `Billed monthly at AED ${price.toLocaleString()} through Stripe's secure checkout. Cancel any time.`
              : 'No payment is needed now — our team will confirm your membership rate with you.'}
          </p>
          <div className="mt-6 space-y-3 border-t border-line pt-5">
            <div className={cx('field', errors['r-terms'] && 'invalid')}>
              <label className="check">
                <input name="terms" {...bindCheck('r-terms')} />
                <span>
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener" className="link">
                    Terms of Service
                  </a>
                  .
                </span>
              </label>
              <FieldError id="r-terms">{errors['r-terms']}</FieldError>
            </div>
            <div className={cx('field', errors['r-privacy'] && 'invalid')}>
              <label className="check">
                <input name="privacy" {...bindCheck('r-privacy')} />
                <span>
                  I have read the{' '}
                  <a href="/privacy" target="_blank" rel="noopener" className="link">
                    Privacy Policy
                  </a>{' '}
                  and consent to the processing of my personal data in line with the UAE Personal Data Protection Law
                  (PDPL).
                </span>
              </label>
              <FieldError id="r-privacy">{errors['r-privacy']}</FieldError>
            </div>
          </div>
        </fieldset>

        {submitError && (
          <p className="mt-6 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[13px] leading-5 text-danger" role="alert">
            {submitError}
          </p>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          {step > 1 ? (
            <button type="button" className="auth-press btn btn-ghost" onClick={() => go(step - 1)} disabled={busy}>
              <i className="bi bi-arrow-left" aria-hidden="true" />
              Back
            </button>
          ) : null}
          <button type="submit" className="auth-press btn btn-dark btn-lg ml-auto" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {step === 3 && price ? 'Opening secure checkout' : 'Setting up'}
              </>
            ) : step === 3 ? (
              price ? (
                <>
                  <i className="bi bi-lock" aria-hidden="true" />
                  Continue to payment
                </>
              ) : (
                <>
                  Create professional account
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </>
              )
            ) : (
              <>
                Continue
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

function TextField({ id, label, optional = undefined, hint = undefined, error, className = undefined, children }) {
  return (
    <div className={cx('field', className, error && 'invalid')}>
      <label className="label" htmlFor={id}>
        {label}
        {optional && <span className="opt"> (optional)</span>}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

/** RERA card / trade licence upload: drag and drop or browse, preview, replace and remove. */
function UploadField({ id, labelId, label, title, file, error, onError, onFile, imageOnly = false }) {
  const inputRef = useRef(null);
  const zoneRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [thumb, setThumb] = useState(null);

  const accept = (f) => {
    if (!f) return;
    const ok = imageOnly
      ? /\.(jpe?g|png)$/i.test(f.name) && /^(image\/jpeg|image\/png)$/.test(f.type)
      : /\.(pdf|jpe?g|png)$/i.test(f.name) && /^(application\/pdf|image\/jpeg|image\/png)?$/.test(f.type);
    if (!ok) return onError(imageOnly ? 'Upload a JPG or PNG image.' : 'Upload a PDF, JPG or PNG file.');
    if (f.size > MAX) return onError('This file is larger than 10 MB.');
    onFile({ name: f.name, size: f.size, type: f.type, file: f });
    setThumb(null);
    if (/^image\//.test(f.type)) {
      const r = new FileReader();
      r.onload = () => setThumb(r.result);
      r.readAsDataURL(f);
    }
  };
  const isImg = file && /^image\//.test(file.type);

  return (
    <div className={cx('field sm:col-span-2', error && 'invalid')}>
      <span className="label" id={labelId}>
        {label}
      </span>
      {!file && (
        <label
          ref={zoneRef}
          className={cx('dropzone', drag && 'is-drag')}
          htmlFor={id}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            accept(e.dataTransfer.files[0]);
          }}
        >
          <i className="bi bi-upload h-5 w-5 text-ink" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-ink">{title}</span>
          <span className="text-xs text-muted">PDF, JPG or PNG · up to 10 MB · drag and drop or browse</span>
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="sr-only"
        accept={
          imageOnly
            ? '.jpg,.jpeg,.png,image/jpeg,image/png'
            : '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
        }
        aria-labelledby={labelId}
        {...errProps(id, error)}
        onChange={(e) => accept(e.target.files[0])}
      />
      {file && (
        <div className="mt-2">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-white p-3">
            {isImg ? (
              thumb ? (
                <img alt="" className="h-12 w-16 rounded object-cover" src={thumb} />
              ) : (
                <span className="h-12 w-16 rounded bg-mist" />
              )
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded bg-mist">
                <i className="bi bi-file-earmark-text h-5 w-5 text-ink" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{file.name}</p>
              <p className="text-xs text-muted">
                {isImg ? 'Image' : 'PDF document'} · {fmtBytes(file.size)} · <span className="text-ok">Ready</span>
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}>
              Replace
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm h-8 w-8 px-0"
              aria-label="Remove file"
              onClick={() => {
                onFile(null);
                setThumb(null);
                if (inputRef.current) inputRef.current.value = '';
                setTimeout(() => zoneRef.current?.focus(), 0);
              }}
            >
              <i className="bi bi-trash3" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

