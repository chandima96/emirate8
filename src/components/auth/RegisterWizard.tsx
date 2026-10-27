'use client';


import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark } from '@/components/layout/Wordmark';
import { useSession } from '@/components/providers/SessionProvider';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useHydrated } from '@/hooks/useStore';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { ensureSeed, findByLogin, register, signIn, currentUser, saveUser, log, plans } from '@/lib/store';
import { uploadRegistrationEvidence } from '@/lib/mediaClient';
import { RX, cx, fmtBytes, normaliseMobile, passwordScore } from '@/lib/utils';
import { PasswordInput, FieldError, errProps, SignedInNote } from './authShared';

const NAMES = ['Account type', 'Your details', 'Credentials', 'Membership'];
const DRAFT_KEY = 'e08:reg-draft';
const PERSIST = ['r-name', 'r-email', 'r-mobile', 'r-brn', 'r-expiry', 'r-agency', 'r-orn', 'r-tl', 'r-agents'];
const TYPES: Array<{ id: string; title: string; icon: string; desc: string; soon?: boolean }> = [
  { id: 'broker', title: 'Licensed Broker', icon: 'person-check', desc: 'For individual real estate professionals.' },
  {
    id: 'agency',
    title: 'Real Estate Agency',
    icon: 'building',
    desc: 'For companies managing agents and property portfolios.',
  },
  { id: 'developer', title: 'Property Developer', icon: 'buildings', desc: 'For developers publishing projects and inventory.' },
];
const S_LABELS = ['Password strength', 'Weak', 'Fair', 'Good', 'Strong'];
const S_COLORS = ['#DCE2DE', '#A23B32', '#8A5A12', '#6E8F78', '#2F6B4A'];
const MAX = 10 * 1024 * 1024;

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

/** Mirrors the old init: draft first, then ?type= and ?plan=, then the furthest safe step. */
function initialState(qType, qPlan) {
  const st = { step: 1, type: null, plan: null, planTouched: false, v: {} };
  const autoPlan = (t) => {
    if (!st.planTouched && t !== 'buyer') st.plan = `${t}-bronze`;
  };
  const draft = loadDraft();
  if (draft) {
    Object.keys(draft.v || {}).forEach((id) => {
      if (PERSIST.includes(id) && draft.v[id]) st.v[id] = draft.v[id];
    });
    st.planTouched = !!draft.planTouched;
    if (draft.type) {
      st.type = draft.type;
      autoPlan(draft.type);
    }
    if (draft.plan) st.plan = draft.plan;
  }
  if (qType === 'agency' || qType === 'broker' || qType === 'developer') {
    st.type = qType;
    autoPlan(qType);
  }
  if (st.type === 'buyer') st.type = null;
  if (qPlan && plans()[qPlan] && (!st.type || plans()[qPlan].roleAudience === st.type)) {
    st.plan = qPlan;
    st.planTouched = true;
  }
  if (st.type && plans()[st.plan]?.roleAudience !== st.type) {
    st.plan = `${st.type}-bronze`;
    st.planTouched = false;
  }
  st.step = draft && draft.step >= 2 && st.type ? 2 : 1;
  return st;
}

export function RegisterWizard() {
  const hydrated = useHydrated();
  const { ready } = useSession();
  const q = useSearchParams();
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[40fr_60fr]">
      <aside className="on-dark relative hidden overflow-hidden bg-ink-deep lg:block" aria-label="About Emirate08">
        <div className="sticky top-0 flex h-screen flex-col">
          <img
            src="/images/register-architecture.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            width="1600"
            height="2400"
          />
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
            <div className="mt-auto max-w-[400px]">
              <h1 className="font-display text-[30px] leading-[1.12] font-semibold text-white xl:text-[34px]">
                Your Next <em className="f font-normal text-sage">Opportunity</em> Starts Here.
              </h1>
              <p className="mt-4 text-[14px] leading-[1.65] text-[#C9D2CF]">
                Establish your professional account and become part of a connected real estate network.
              </p>
              <ul className="mt-7 space-y-3 border-t border-white/15 pt-6 text-[13px] text-white">
                <li className="flex items-center gap-3">
                  <i className="bi bi-person-vcard h-4 w-4 text-sage" aria-hidden="true" />
                  Professional profile
                </li>
                <li className="flex items-center gap-3">
                  <i className="bi bi-buildings h-4 w-4 text-sage" aria-hidden="true" />
                  Property management
                </li>
                <li className="flex items-center gap-3">
                  <i className="bi bi-diagram-3 h-4 w-4 text-sage" aria-hidden="true" />
                  Broker network access
                </li>
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
            <Link href="/login" className="link">
              Sign in
            </Link>
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-[600px] flex-1 flex-col px-5 pb-10 sm:px-8">
          {ready && !q.get('stay') && <SignedInNote className="mb-4" />}
          {hydrated ? <Wizard qType={q.get('type')} qPlan={q.get('plan')} /> : <div className="min-h-[480px]" />}
        </div>
      </div>
    </div>
  );
}

function Wizard({ qType, qPlan }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [init] = useState(() => initialState(qType, qPlan));
  const [step, setStep] = useState(init.step);
  const [type, setTypeState] = useState(init.type);
  const planCards = Object.values(plans()).filter((item) => item.roleAudience === type).map((item) => ({
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
  const [v, setV] = useState(() => ({ 'r-password': '', 'r-password2': '', ...init.v }));
  const [files, setFiles] = useState({ cardFile: null, licenceFile: null, developerLogo: null });
  const [checks, setChecks] = useState({ 'r-terms': false, 'r-privacy': false, 'by-terms': false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [typeError, setTypeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState(null); // { mobile } while the modal is open
  const [success, setSuccess] = useState(null); // { verified }
  const doneRef = useRef(false);
  const focusStep = useRef(false);
  const fieldsetRefs = useRef({});
  const successRef = useRef(null);

  /* ---------- Draft persistence (no passwords or files) ---------- */
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

  /* Step change: fade in the fieldset, focus its heading, scroll to top. */
  useEffect(() => {
    const f = fieldsetRefs.current[step];
    f?.animate?.(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(.22,.61,.36,1)',
      },
    );
    if (focusStep.current) {
      focusStep.current = false;
      f?.querySelector('[data-step-heading]')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  useEffect(() => {
    if (success) {
      successRef.current?.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [success]);

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

  const setType = (t) => {
    setTypeState(t);
    setTypeError(false);
    setPlanState(`${t}-bronze`);
    setPlanTouched(false);
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
    }
    if (n === 2) {
      if (val('r-name').length < 3 || !/\s/.test(val('r-name'))) fail('r-name', 'Enter your first and last name.');
      if (!RX.email.test(val('r-email'))) fail('r-email', 'Enter a valid email address, e.g. name@company.ae.');
      else if (findByLogin(val('r-email')))
        fail('r-email', 'An account with this email already exists — sign in instead.');
      if (!/^(?:971|0)?5[024568]\d{7}$/.test(val('r-mobile').replace(/\D/g, '')))
        fail('r-mobile', 'Enter a UAE mobile number, e.g. 50 123 4567.');
      const p = v['r-password'];
      if (p.length < 8) fail('r-password', 'Use at least 8 characters.');
      else if (passwordScore(p) < 3) fail('r-password', 'Add upper and lower case letters and a number.');
      if (!v['r-password2']) fail('r-password2', 'Confirm your password.');
      else if (v['r-password2'] !== p) fail('r-password2', 'Passwords don’t match.');
    }
    if (n === 3) {
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
    if (n === 4) {
      if (!checks['r-terms']) fail('r-terms', 'Please accept the Terms of Service.');
      if (!checks['r-privacy']) fail('r-privacy', 'Please confirm the Privacy Policy and PDPL consent.');
    }
    setErrors((e) => ({ ...e, ...er }));
    if (order.length) document.getElementById(order[0])?.focus();
    return !order.length;
  };

  const go = (n) => {
    focusStep.current = true;
    setStep(n);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (busy || !validate(step)) return;
    if (step < 4) {
      go(step + 1);
      return;
    }
    setBusy(true);
    const mob = normaliseMobile(val('r-mobile'));
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
          ? { developerName: val('r-name'), developerLogo: files.developerLogo }
          : { brn: val('r-brn'), expiry: val('r-expiry'), cardFile: files.cardFile };
    Promise.all(
      [
        ['cardFile', creds.cardFile],
        ['licenceFile', creds.licenceFile],
        ['developerLogo', creds.developerLogo],
      ].map(async ([key, file]) => {
        if (!file?.file) return [key, file];
        return [key, await uploadRegistrationEvidence(file.file, file.name)];
      }),
    )
      .then((uploads) => {
        uploads.forEach(([key, file]) => {
          if (file) creds[key] = file;
        });
        return ensureSeed();
      })
      .then(() =>
        register({
          name: val('r-name'),
          email: val('r-email'),
          mobile: mob,
          password: v['r-password'],
          type,
          plan: plan || 'starter',
          credentials: creds,
        }),
      )
      .then((res) => {
        setBusy(false);
        if (!res.ok) {
          go(2);
          setErrors((er) => ({ ...er, 'r-email': res.message }));
          return;
        }
        signIn(res.user.id, true);
        doneRef.current = true;
        clearDraft();
        setOtp({ mobile: mob });
      })
      .catch((error) => {
        setBusy(false);
        go(3);
        setErrors((er) => ({
          ...er,
          'r-card': error instanceof Error ? error.message : 'Could not upload your evidence.',
        }));
      });
  };

  const finish = (verified) => {
    const u = currentUser();
    if (u) {
      u.mobileVerified = verified;
      saveUser(u);
      log(
        verified ? 'Mobile number verified (demo OTP)' : 'Mobile verification postponed',
        verified ? 'smartphone' : 'clock-3',
      );
    }
    setOtp(null);
    setSuccess({ verified });
  };

  const ps = v['r-password'] ? Math.max(1, passwordScore(v['r-password'])) : 0;
  const nextDisabled = busy;
  const credKind = type === 'agency' ? 'agency' : type === 'developer' ? 'developer' : 'broker';

  if (success) {
    return (
      <section className="pt-6 lg:pt-14" tabIndex={-1} ref={successRef} aria-labelledby="success-title">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage text-ink">
          <i className="bi bi-check-lg h-5 w-5" aria-hidden="true" />
        </span>
        <h2 id="success-title" className="h2 mt-6">
          Welcome to <em className="f font-normal">Emirate08.</em>
        </h2>
        <p className="mt-2 max-w-[480px] text-[14px] leading-[1.65] text-muted">
          Your account has been created. Your professional credentials are pending review.
        </p>
        <ul className="mt-7 divide-y divide-line rounded-lg border border-line bg-white">
          <li className="flex items-center gap-3 px-4 py-3.5 text-[14px]">
            <i className="bi bi-check-circle h-5 w-5 text-ok" aria-hidden="true" />
            <span className="flex-1">Account Created</span>
            <span className="badge badge-ok">Done</span>
          </li>
          {success.verified ? (
            <li className="flex items-center gap-3 px-4 py-3.5 text-[14px]">
              <i className="bi bi-check-circle h-5 w-5 text-ok" aria-hidden="true" />
              <span className="flex-1">Mobile Verification Completed in Demo</span>
              <span className="badge badge-ok">Demo</span>
            </li>
          ) : (
            <li className="flex items-center gap-3 px-4 py-3.5 text-[14px]">
              <i className="bi bi-clock h-5 w-5 text-warn" aria-hidden="true" />
              <span className="flex-1">Mobile Verification Pending</span>
              <span className="badge badge-warn">Later</span>
            </li>
          )}
          <li className="flex items-center gap-3 px-4 py-3.5 text-[14px]">
            <i className="bi bi-clock h-5 w-5 text-warn" aria-hidden="true" />
            <span className="flex-1">Professional Review Pending</span>
            <span className="badge badge-warn">Pending</span>
          </li>
        </ul>
        <p className="mt-4 text-xs leading-[1.6] text-muted">
          While review is pending you can complete your profile, prepare listing drafts, and browse the broker network.
          Publishing unlocks once credentials are verified. To try it, use “Verify credentials (demo)” under Account →
          Credentials.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn btn-dark btn-lg">
            Go to Dashboard
            <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
          <Link href="/profile" className="btn btn-outline btn-lg">
            Complete Profile
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* Progress */}
      <div className="pt-2 lg:pt-6">
        <div className="flex items-center justify-between text-2xs font-semibold tracking-[.12em] text-muted uppercase">
          <span>Step {step} of 4</span>
          <span>{NAMES[step - 1]}</span>
        </div>
        <div className="meter mt-2.5">
          <span style={{ width: (step / 4) * 100 + '%' }} />
        </div>
        <ol className="mt-4 hidden grid-cols-4 gap-2 sm:grid" aria-label="Registration steps">
          {NAMES.map((name, i) => {
            const n = i + 1;
            return (
              <li
                key={name}
                className={cx('step flex items-center gap-2', n === step && 'is-current', n < step && 'is-done')}
                aria-current={n === step ? 'step' : undefined}
              >
                <span className="step-dot">{n < step ? <Icon name="check-lg" className="h-3 w-3" /> : n}</span>
                <span className="step-label">{name}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <form className="mt-8 lg:mt-10" noValidate autoComplete="on" onSubmit={onSubmit}>
        {/* STEP 1 */}
        <fieldset
          ref={(el) => {
            fieldsetRefs.current[1] = el;
          }}
          hidden={step !== 1}
        >
          <legend className="sr-only">Account type</legend>
          <h2 className="h2 text-[26px] lg:text-[30px]" tabIndex={-1} data-step-heading>
            How Will You Use <em className="f font-normal">Emirate08?</em>
          </h2>
          <p className="mt-2 text-[14px] text-muted">Choose the account type that best describes your business.</p>
          <div
            className="mt-6 grid gap-3"
            role="radiogroup"
            aria-label="Account type"
            onKeyDown={radioKeys(TYPES, setType)}
          >
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={type === t.id}
                tabIndex={type === t.id || (!type && t.id === 'broker') ? 0 : -1}
                className="option-card"
                data-type={t.id}
                onClick={() => setType(t.id)}
              >
                <span className="radio-dot" />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-[16px] font-semibold text-ink">{t.title}</span>
                    {t.soon ? (
                      <span className="badge badge-sage">Coming soon</span>
                    ) : (
                      <i className={`bi bi-${t.icon} h-5 w-5 text-muted`} aria-hidden="true" />
                    )}
                  </span>
                  <span className="mt-1 block text-[13px] text-muted">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <div
            className="mt-4 rounded-lg border border-line bg-white p-4"
            hidden={type !== 'buyer'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as Element).matches('input:not([type=checkbox])')) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
            }}
          >
            <p className="text-[13px] text-text">
              <span className="font-semibold">A free buyer account</span> — no professional documents needed.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className={cx('field sm:col-span-2', errors['by-name'] && 'invalid')}>
                <label className="label" htmlFor="by-name">
                  Full name
                </label>
                <input className="input" autoComplete="name" {...bind('by-name')} />
                <FieldError id="by-name">{errors['by-name']}</FieldError>
              </div>
              <div className={cx('field', errors['by-email'] && 'invalid')}>
                <label className="label" htmlFor="by-email">
                  Email
                </label>
                <input type="email" className="input" autoComplete="email" {...bind('by-email')} />
                <FieldError id="by-email">{errors['by-email']}</FieldError>
              </div>
              <div className={cx('field', errors['by-pw'] && 'invalid')}>
                <label className="label" htmlFor="by-pw">
                  Password
                </label>
                <input type="password" className="input" autoComplete="new-password" {...bind('by-pw')} />
                <p className="hint">8+ characters with upper and lower case and a number.</p>
                <FieldError id="by-pw">{errors['by-pw']}</FieldError>
              </div>
            </div>
            <div className={cx('field mt-3', errors['by-terms'] && 'invalid')}>
              <label className="check">
                <input {...bindCheck('by-terms')} />
                <span>
                  I agree to the{' '}
                  <Link className="link" href="/terms">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link className="link" href="/privacy">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              <FieldError id="by-terms">{errors['by-terms']}</FieldError>
            </div>
            <button type="button" className="btn btn-dark btn-lg mt-4 w-full sm:w-auto" onClick={() => undefined}>
              Create buyer account
            </button>
          </div>
          <div className="mt-4 rounded-lg border border-line bg-white p-4" hidden={type !== 'developer'}>
            <p className="text-[13px] text-text">
              <span className="font-semibold">Developer accounts publish project inventory.</span> Complete the
              professional details below so your account can be reviewed.
            </p>
            <p className="mt-2 text-2xs text-muted">Developer verification is completed after registration.</p>
          </div>
          {typeError && (
            <p className="mt-3 text-xs text-danger" role="alert">
              <i className="bi bi-exclamation-circle mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Choose an account type to continue.
            </p>
          )}
        </fieldset>

        {/* STEP 2 */}
        <fieldset
          ref={(el) => {
            fieldsetRefs.current[2] = el;
          }}
          hidden={step !== 2}
        >
          <legend className="sr-only">Account details</legend>
          <h2 className="h2 text-[26px] lg:text-[30px]" tabIndex={-1} data-step-heading>
            Let&apos;s Create Your <em className="f font-normal">Account.</em>
          </h2>
          <p className="mt-2 text-[14px] text-muted">Start with your basic contact information.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <TextField id="r-name" label="Full Name" className="sm:col-span-2" error={errors['r-name']}>
              <input
                name="name"
                className="input"
                autoComplete="name"
                placeholder="As shown on your RERA card"
                {...bind('r-name')}
              />
            </TextField>
            <TextField id="r-email" label="Email Address" error={errors['r-email']}>
              <input
                name="email"
                type="email"
                className="input"
                autoComplete="email"
                placeholder="name@company.ae"
                {...bind('r-email')}
              />
            </TextField>
            <TextField id="r-mobile" label="UAE Mobile Number" error={errors['r-mobile']}>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-muted">
                  +971
                </span>
                <input
                  name="mobile"
                  type="tel"
                  inputMode="tel"
                  className="input pl-[52px]"
                  autoComplete="tel-national"
                  placeholder="50 123 4567"
                  {...bind('r-mobile')}
                  onBlur={() => {
                    let d = String(v['r-mobile'] || '').replace(/\D/g, '');
                    if (d.indexOf('971') === 0) d = d.slice(3);
                    if (d.indexOf('0') === 0) d = d.slice(1);
                    if (d.length === 9)
                      setV((s) => ({ ...s, 'r-mobile': d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5) }));
                  }}
                />
              </div>
            </TextField>
            <TextField id="r-password" label="Password" error={errors['r-password']}>
              <PasswordInput
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                invalid={!!errors['r-password']}
                {...bind('r-password')}
              />
            </TextField>
            <TextField id="r-password2" label="Confirm Password" error={errors['r-password2']}>
              <PasswordInput
                name="password2"
                autoComplete="new-password"
                placeholder="Repeat password"
                invalid={!!errors['r-password2']}
                {...bind('r-password2')}
              />
            </TextField>
            <div className="sm:col-span-2" aria-live="polite">
              <div className="strength grid grid-cols-4 gap-1.5" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className="h-1 rounded-full bg-line"
                    style={{ backgroundColor: n <= ps ? S_COLORS[ps] : '#DCE2DE' }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                <span className="font-semibold text-ink">{S_LABELS[ps]}</span> · Use 8+ characters with upper and lower
                case letters and a number.
              </p>
            </div>
          </div>
        </fieldset>

        {/* STEP 3 */}
        <fieldset
          ref={(el) => {
            fieldsetRefs.current[3] = el;
          }}
          hidden={step !== 3}
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
              Add your company logo so brokers can recognise your developer card. You can skip this and use the default logo.
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
            Credential details are saved to your account. Credential documents are not currently uploaded; only the
            selected file name is recorded.
          </p>
        </fieldset>

        {/* STEP 4 */}
        <fieldset
          ref={(el) => {
            fieldsetRefs.current[4] = el;
          }}
          hidden={step !== 4}
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
            {planCards.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={plan === p.id}
                tabIndex={plan === p.id ? 0 : -1}
                className="option-card"
                data-plan={p.id}
                onClick={() => setPlan(p.id)}
              >
                <span className="radio-dot" />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-[16px] font-semibold text-ink">{plans()[p.id].name}</span>
                    <span className="text-xs font-semibold text-muted">Pricing to be confirmed</span>
                  </span>
                  <span className="mt-1 block text-[13px] text-muted">{p.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <i className="bi bi-calendar-event h-3.5 w-3.5 text-ink" aria-hidden="true" />
            Every plan starts with a 14-day trial. No payment details are requested during registration.
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

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          {step > 1 && (
            <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>
              <i className="bi bi-arrow-left" aria-hidden="true" />
              Back
            </button>
          )}
          {step === 1 && <span className="text-xs text-muted">Your progress is kept on this device.</span>}
          <button type="submit" className="btn btn-dark btn-lg ml-auto" disabled={nextDisabled}>
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating account
              </>
            ) : (
              <>
                {step === 4 ? 'Create Account' : 'Continue'}
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>

      <OtpModal mobile={otp?.mobile} onDone={finish} toast={toast} />
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
        accept={imageOnly ? '.jpg,.jpeg,.png,image/jpeg,image/png' : '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'}
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

/* ---------- Demo OTP ---------- */
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

function OtpModal({ mobile, onDone, toast }) {
  const open = !!mobile;
  return (
    <Modal open={open} onClose={() => {}} closeOnEsc={false} labelledBy="otp-title" panelClassName="p-6 sm:p-7">
      {open && <OtpBody mobile={mobile} onDone={onDone} toast={toast} />}
    </Modal>
  );
}

function OtpBody({ mobile, onDone, toast }) {
  const [code, setCode] = useState(newCode);
  const [digitsV, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);
  const [secs, setSecs] = useState(30);
  const [round, setRound] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [round]);

  const check = (arr) => {
    const entered = arr.join('');
    if (entered.length < 6) {
      setError('Enter all six digits.');
      refs.current[arr.findIndex((d) => !d)]?.focus();
      return;
    }
    if (entered !== code) {
      setError('That code doesn’t match. Check the demo code above and try again.');
      setDigits(['', '', '', '', '', '']);
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
      refs.current[0]?.focus();
      return;
    }
    onDone(true);
  };

  const fill = (str, start) => {
    const arr = [...digitsV];
    str
      .slice(0, 6 - start)
      .split('')
      .forEach((d, k) => (arr[start + k] = d));
    setDigits(arr);
    refs.current[Math.min(5, start + str.length - 1)]?.focus();
    if (arr.every(Boolean)) check(arr);
  };

  const onInput = (i, raw) => {
    const d = raw.replace(/\D/g, '');
    if (d.length > 1) return fill(d, i);
    const arr = [...digitsV];
    arr[i] = d;
    setDigits(arr);
    setError('');
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (arr.every(Boolean)) check(arr);
  };

  const resend = () => {
    setCode(newCode());
    setSecs(30);
    setRound((r) => r + 1);
    setDigits(['', '', '', '', '', '']);
    refs.current[0]?.focus();
    toast('New demo code generated — nothing was sent.', { icon: 'arrow-repeat' });
  };

  return (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mist text-ink">
        <i className="bi bi-phone h-5 w-5" aria-hidden="true" />
      </span>
      <h2 id="otp-title" className="h3 mt-4">
        Verify Your Mobile Number
      </h2>
      <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">
        Enter the six-digit code for <span className="font-semibold text-ink">{mobile}</span>.
      </p>
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-3 text-xs leading-[1.55] text-warn">
        <i className="bi bi-info-circle mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>
          <span className="font-semibold">Demo OTP — no SMS or WhatsApp message has been sent.</span> Use code{' '}
          <span className="font-display text-[13px] font-semibold tracking-[.2em]" data-otp-demo>
            {code}
          </span>
        </p>
      </div>
      <form
        className="mt-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          check(digitsV);
        }}
      >
        <fieldset>
          <legend className="sr-only">Six-digit code</legend>
          <div className="flex justify-between gap-1.5 sm:gap-2">
            {digitsV.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={cx('otp-input', flash && 'border-danger')}
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
                    const arr = [...digitsV];
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
        <button type="submit" className="btn btn-dark btn-lg mt-3 w-full">
          Verify &amp; Continue
        </button>
        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            className="font-semibold text-ink disabled:cursor-not-allowed disabled:text-muted"
            disabled={secs > 0}
            onClick={resend}
          >
            {secs > 0 ? <>Resend code in {secs}s</> : 'Resend demo code'}
          </button>
          <button
            type="button"
            className="text-muted underline underline-offset-4 hover:text-ink"
            onClick={() => onDone(false)}
          >
            Verify later
          </button>
        </div>
      </form>
    </>
  );
}
