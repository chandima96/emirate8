'use client';

import { authenticateAction } from '@/app/actions';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Field, invalidProps } from '@/components/ui/Field';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import {
  counts,
  currentUser,
  data,
  deleteUser,
  fmtDate,
  inbox,
  log,
  plan,
  resetDemo,
  saveUser,
  session,
  signOut,
  verifyDemoCredentials,
} from '@/lib/store';
import { RX, digits, initialsOf, normaliseMobile, passwordScore } from '@/lib/utils';
import { SectionNav, ToggleRow, credText, useHashTabs } from './shared';

const TABS = ['personal', 'credentials', 'security', 'privacy', 'preferences', 'plan'];
const NAV = [
  ['personal', 'person', 'Personal information'],
  ['credentials', 'shield-check', 'Credentials'],
  ['security', 'lock', 'Login & security'],
  ['privacy', 'eye-slash', 'Privacy'],
  ['preferences', 'sliders', 'Preferences'],
  ['plan', 'credit-card', 'Subscription & plan'],
];

function CredentialValue({ value }) {
  if (!value) return <>—</>;
  if (typeof value === 'object' && value.url) {
    return (
      <a href={value.url} target="_blank" rel="noreferrer" className="link">
        {value.filename || 'Open uploaded document'}
      </a>
    );
  }
  return <>{String(value)}</>;
}
const PRIV = [
  ['showPhone', 'Public phone number', 'Shows the Call button on your portfolio and listings.'],
  ['showWhatsapp', 'WhatsApp number', 'Shows the WhatsApp button.'],
  ['showEmail', 'Public business email', 'Email enquiries still reach you through the Emirate08 form.'],
  ['showBrn', 'RERA BRN and verification badge', 'Recommended — buyers look for verified brokers.'],
  ['showLanguages', 'Languages', ''],
  ['showExperience', 'Years of experience', ''],
  ['showTransactions', 'Recorded sales and rentals', 'Counts of listings you’ve marked sold or rented on Emirate08.'],
];
const NOTIF = [
  ['enquiries', 'New enquiries', 'When a buyer contacts you from your portfolio or a listing.'],
  ['network', 'New network opportunities', 'Matching properties published by other brokers.'],
  ['selection', 'Selected property updates', 'When a property in your collection changes or becomes unavailable.'],
  ['billing', 'Billing & plan', 'Trial reminders and plan changes.'],
  ['product', 'Product news', 'Occasional updates about new Emirate08 features.'],
];

const focus = (id) => setTimeout(() => document.getElementById(id)?.focus(), 0);

function SaveRow({ note, label }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-5">
      <span className="text-xs text-muted">{note}</span>
      <button type="submit" className="btn btn-dark">
        {label}
      </button>
    </div>
  );
}

/* ---------- Personal ---------- */
function Personal({ user }) {
  const { toast } = useFeedback();
  const [f, setF] = useState({
    name: user.name,
    legal: user.legalName || user.name,
    mobile: user.mobile || '',
    office: user.officeAddress || '',
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    if (err[k]) setErr({ ...err, [k]: '' });
  };
  const submit = (e) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().split(/\s+/).length < 2) er.name = 'Enter your first and last name.';
    if (!RX.uaeMobile.test(digits(f.mobile))) er.mobile = 'Enter a UAE mobile number.';
    setErr(er);
    if (Object.keys(er).length) return;
    const u = currentUser();
    const newMob = normaliseMobile(f.mobile);
    if (digits(newMob) !== digits(u.mobile)) u.mobileVerified = false;
    u.name = f.name.trim();
    u.legalName = f.legal.trim();
    u.mobile = newMob;
    u.officeAddress = f.office.trim();
    saveUser(u);
    log('Updated personal information', 'person');
    setF({ ...f, mobile: newMob });
    setNote('Saved just now');
    toast('Personal information saved. This doesn’t change your public portfolio.');
  };
  return (
    <form className="card p-5 sm:p-7" noValidate onSubmit={submit}>
      <h2 className="h3">Personal information</h2>
      <p className="mt-1 text-[13px] text-muted">
        Used by Emirate08 for account administration. Not shown on your portfolio.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field id="p-name" label="Account name" error={err.name}>
          <input
            id="p-name"
            className="input"
            autoComplete="name"
            value={f.name}
            onChange={set('name')}
            {...invalidProps('p-name', err.name)}
          />
        </Field>
        <Field id="p-legal" label="Legal name" optional="as on your RERA card">
          <input id="p-legal" className="input" value={f.legal} onChange={set('legal')} />
        </Field>
        <div className="field">
          <label className="label" htmlFor="p-email">
            Personal email
          </label>
          <input
            id="p-email"
            type="email"
            className="input"
            autoComplete="email"
            readOnly
            value={user.email}
            aria-describedby="p-email-hint"
          />
          <p className="hint" id="p-email-hint">
            Change it under Login &amp; security.
          </p>
        </div>
        <Field
          id="p-mobile"
          label="Personal mobile number"
          error={err.mobile}
          hint={
            user.mobileVerified ? (
              <span className="text-ok">Verified (demo OTP)</span>
            ) : (
              <span className="text-warn">Not verified yet</span>
            )
          }
        >
          <input
            id="p-mobile"
            type="tel"
            className="input"
            autoComplete="tel"
            value={f.mobile}
            onChange={set('mobile')}
            {...invalidProps('p-mobile', err.mobile)}
          />
        </Field>
        <Field id="p-office" label="Office or billing address" optional="optional" className="sm:col-span-2">
          <input
            id="p-office"
            className="input"
            autoComplete="street-address"
            value={f.office}
            onChange={set('office')}
          />
        </Field>
      </div>
      <SaveRow note={note} label="Save changes" />
    </form>
  );
}

/* ---------- Credentials ---------- */
function Credentials({ user }) {
  const { toast, confirm } = useFeedback();
  const [verifying, setVerifying] = useState(false);
  const verifyDemo = async () => {
    setVerifying(true);
    try {
      await verifyDemoCredentials();
      log('Professional credentials verified (demo)', 'shield-check');
      toast('Professional credentials verified');
    } catch (error) {
      toast(error.message, { icon: 'exclamation-circle' });
    } finally {
      setVerifying(false);
    }
  };
  const c = user.credentials || {};
  const cs = credText(user);
  const rows =
    user.type === 'agency'
      ? [
          ['Account type', 'Real estate agency'],
          ['Agency name', c.agencyName],
          ['ORN', c.orn],
          ['Trade licence number', c.tradeLicence],
          ['Trade licence document', c.licenceFile],
          ['Number of agents', c.agents || '—'],
        ]
      : [
          ['Account type', 'Licensed broker'],
          ['RERA BRN', c.brn],
          ['RERA card expiry', fmtDate(c.expiry)],
          ['RERA card document', c.cardFile],
        ];
  const st = user.credentialStatus;
  const credentialReview = user.credentialReview || {};
  const rejectedFields = Object.entries(credentialReview.checks || {})
    .filter(([, passed]) => passed !== true)
    .map(([key]) => ({ fullName: 'Full Name', brn: 'RERA BRN', expiry: 'RERA Expire Date' }[key] || key));
  const steps = [
    ['Submitted', 'Documents received'],
    ['Under review', 'Checked against RERA records'],
    ['Verified', 'Publishing unlocked'],
  ];
  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name) || file.size > 10 * 1048576) {
      toast('Upload a PDF, JPG or PNG under 10 MB.', { icon: 'exclamation-circle' });
      return;
    }
    const ok = await confirm({
      title: 'Restart credential review?',
      body: 'Your credentials go back to “pending review”. While pending, newly published listings wait for review.',
      ok: 'Submit document',
    });
    if (!ok) return;
    const u = currentUser();
    u.credentials = u.credentials || {};
    if (u.type === 'agency') u.credentials.licenceFile = file.name;
    else u.credentials.cardFile = file.name;
    u.credentialStatus = 'pending';
    saveUser(u);
    log('Submitted an updated credential document', 'upload');
    toast('Document received (file name only). Review restarted.');
  };
  return (
    <section className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="h3">Professional credentials</h2>
          <p className="mt-1 text-[13px] text-muted">
            Reviewed before you can publish listings. Verified credentials show a badge on your portfolio.
          </p>
        </div>
        <span className={'badge ' + cs[1]}>{cs[0]}</span>
      </div>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {steps.map(([t, d], i) => {
          const done = i === 0 || st === 'verified';
          const current = i === 1 && st !== 'verified';
          return (
            <li
              key={t}
              className={'rounded-lg border p-3 ' + (current ? 'border-warn/40 bg-warn-soft' : 'border-line')}
            >
              <div className="flex items-center gap-2">
                <Icon
                  name={done ? 'check-circle-fill' : current ? 'clock' : 'circle'}
                  className={'h-4 w-4 ' + (done ? 'text-ok' : current ? 'text-warn' : 'text-muted')}
                />
                <span className="text-[13px] font-semibold text-ink">{t}</span>
              </div>
              <p className="mt-1 text-2xs text-muted">{d}</p>
            </li>
          );
        })}
      </ol>
      {st === 'rejected' && credentialReview.reason && (
        <div className="mt-5 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <p className="font-semibold">Verification needs correction</p>
          <p className="mt-1">{credentialReview.reason}</p>
          {rejectedFields.length > 0 && (
            <p className="mt-2 text-xs">Fields to review: {rejectedFields.join(', ')}</p>
          )}
        </div>
      )}
      <dl className="mt-6 divide-y divide-line rounded-lg border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-[13px]">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold text-ink">
              <CredentialValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-mist px-4 py-3 text-xs leading-[1.6] text-muted">
        <Icon name="info-circle" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
        <p>
          Use demo verification to try publishing with verified credentials. This simulates a review without checking
          RERA records. Submitting a new document restarts the review.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn btn-dark" onClick={verifyDemo} disabled={verifying || st === 'verified'}>
          <Icon name="shield-check" />
          {st === 'verified'
            ? 'Professional credentials verified'
            : verifying
              ? 'Verifying…'
              : 'Verify credentials (demo)'}
        </button>
        <label className="btn btn-outline cursor-pointer" htmlFor="p-newdoc">
          <Icon name="upload" />
          Submit updated document
        </label>
        <input id="p-newdoc" type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={onFile} />
      </div>
    </section>
  );
}

/* ---------- Login & security ---------- */
function DeleteModal({ open, onClose }) {
  const [f, setF] = useState({ confirm: '', pw: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    if (err[k]) setErr({ ...err, [k]: '' });
  };
  const submit = async (e) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.confirm.trim() !== 'DELETE') er.confirm = 'Type DELETE in capital letters.';
    if (!f.pw) er.pw = 'Enter your password.';
    setErr(er);
    if (Object.keys(er).length) return;
    const u = currentUser();
    try {
      await deleteUser(u.id, f.pw);
      // Full reload on purpose: the session is gone and the workspace guard must not redirect first.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/?deleted=1';
    } catch (error) {
      setErr({ pw: error instanceof Error ? error.message : 'Could not delete the account.' });
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      role="alertdialog"
      labelledBy="del-title"
      panelClassName="p-6"
      as="form"
      panelProps={{ noValidate: true, onSubmit: submit }}
    >
      <h2 id="del-title" className="h4 text-danger">
        Delete your account?
      </h2>
      <p className="mt-2 text-[13px] leading-[1.6] text-muted">
        Your account, public portfolio, listings and broker enquiries will be permanently removed from the platform.
        Published listings disappear from search immediately.
      </p>
      <Field id="del-confirm" label="Type DELETE to confirm" error={err.confirm} className="mt-4">
        <input
          id="del-confirm"
          className="input"
          autoComplete="off"
          value={f.confirm}
          onChange={set('confirm')}
          {...invalidProps('del-confirm', err.confirm)}
        />
      </Field>
      <Field id="del-pw" label="Current password" error={err.pw} className="mt-3">
        <input
          id="del-pw"
          type="password"
          className="input"
          autoComplete="current-password"
          value={f.pw}
          onChange={set('pw')}
          {...invalidProps('del-pw', err.pw)}
        />
      </Field>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-danger">
          Delete account
        </button>
      </div>
    </Modal>
  );
}

function Security({ user }) {
  const { toast, confirm } = useFeedback();
  const [em, setEm] = useState({ email: '', pw: '' });
  const [emErr, setEmErr] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ cur: '', n1: '', n2: '' });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [delOpen, setDelOpen] = useState(false);
  const [s0] = useState(session);

  const emailSubmit = async (e) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    const u = currentUser();
    if (!RX.email.test(em.email.trim())) er.email = 'Enter a valid email address.';
    if (!em.pw) er.pw = 'Enter your current password.';
    setEmErr(er);
    if (Object.keys(er).length) return;
    try {
      const result = await authenticateAction({
        action: 'change-email',
        email: em.email.trim(),
        currentPassword: em.pw,
      });
      if (!result.ok) throw new Error(result.error || 'Could not update the email address.');
      Object.assign(u, result.user);
      saveUser(u);
      log('Changed sign-in email', 'envelope');
      setEm({ email: '', pw: '' });
      toast('Sign-in email updated.');
    } catch (error) {
      setEmErr({ pw: error instanceof Error ? error.message : 'Current password is incorrect.' });
      focus('s-email-pw');
    }
  };

  const pwSubmit = async (e) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    const u = currentUser();
    if (pw.n1.length < 8 || passwordScore(pw.n1) < 3)
      er.n1 = 'Use 8+ characters with upper and lower case letters and a number.';
    if (pw.n2 !== pw.n1) er.n2 = 'Passwords don’t match.';
    if (!pw.cur) er.cur = 'Enter your current password.';
    setPwErr(er);
    if (Object.keys(er).length) return;
    try {
      const result = await authenticateAction({ action: 'change-password', password: pw.n1, currentPassword: pw.cur });
      if (!result.ok) throw new Error(result.error || 'Could not update the password.');
      log('Changed password', 'lock');
      setPw({ cur: '', n1: '', n2: '' });
      toast('Password updated.');
    } catch (error) {
      setPwErr({ cur: error instanceof Error ? error.message : 'Current password is incorrect.' });
      focus('s-current');
    }
  };

  const exportData = () => {
    const u = { ...currentUser() };
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            note: 'Emirate08 demo data export',
            account: u,
            workspace: data(),
            enquiries: inbox(),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'emirate08-my-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Clear workspace data?',
      body: 'Your listings, saved properties, selections, recent activity and workspace notes will be permanently deleted. Your account and enquiries will remain.',
      ok: 'Clear workspace',
      danger: true,
    });
    if (!ok) return;
    await resetDemo();
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    // Reload so providers fetch the cleared workspace state from Supabase.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/';
  };

  const logout = () => {
    signOut();
    // Hard navigation avoids a race with the workspace guard while returning to the public homepage.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/';
  };

  const emSet = (k) => (e) => {
    setEm({ ...em, [k]: e.target.value });
    if (emErr[k]) setEmErr({ ...emErr, [k]: '' });
  };
  const pwSet = (k) => (e) => {
    setPw({ ...pw, [k]: e.target.value });
    if (pwErr[k]) setPwErr({ ...pwErr, [k]: '' });
  };

  return (
    <section className="space-y-4">
      <form className="card p-5 sm:p-7" noValidate onSubmit={emailSubmit}>
        <h2 className="h3">Change email</h2>
        <p className="mt-1 text-[13px] text-muted">Your sign-in email. Confirm with your current password.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field id="s-email" label="New email" error={emErr.email}>
            <input
              id="s-email"
              type="email"
              className="input"
              autoComplete="email"
              value={em.email}
              onChange={emSet('email')}
              {...invalidProps('s-email', emErr.email)}
            />
          </Field>
          <Field id="s-email-pw" label="Current password" error={emErr.pw}>
            <input
              id="s-email-pw"
              type="password"
              className="input"
              autoComplete="current-password"
              value={em.pw}
              onChange={emSet('pw')}
              {...invalidProps('s-email-pw', emErr.pw)}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" className="btn btn-dark">
            Update email
          </button>
        </div>
      </form>
      <form className="card p-5 sm:p-7" noValidate onSubmit={pwSubmit}>
        <h2 className="h3">Change password</h2>
        <p className="mt-1 text-[13px] text-muted">Passwords are securely managed by the account service.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field id="s-current" label="Current password" error={pwErr.cur} className="sm:col-span-2">
            <input
              id="s-current"
              type="password"
              className="input"
              autoComplete="current-password"
              value={pw.cur}
              onChange={pwSet('cur')}
              {...invalidProps('s-current', pwErr.cur)}
            />
          </Field>
          <Field id="s-new" label="New password" error={pwErr.n1}>
            <input
              id="s-new"
              type="password"
              className="input"
              autoComplete="new-password"
              value={pw.n1}
              onChange={pwSet('n1')}
              {...invalidProps('s-new', pwErr.n1)}
            />
          </Field>
          <Field id="s-new2" label="Confirm new password" error={pwErr.n2}>
            <input
              id="s-new2"
              type="password"
              className="input"
              autoComplete="new-password"
              value={pw.n2}
              onChange={pwSet('n2')}
              {...invalidProps('s-new2', pwErr.n2)}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" className="btn btn-dark">
            Update password
          </button>
        </div>
      </form>
      <div className="card p-5 sm:p-7">
        <h2 className="h3">Account security</h2>
        <div className="mt-5 divide-y divide-line rounded-lg border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[13px] font-semibold text-ink">Current session</p>
              <p className="text-xs text-muted">
                {'Signed in on this browser' +
                  (s0 && s0.at ? ' since ' + fmtDate(s0.at) : '') +
                  (s0 && s0.remember ? ' · remembered' : '')}
              </p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
              <Icon name="box-arrow-right" />
              Sign out
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[13px] font-semibold text-ink">Download my data</p>
              <p className="text-xs text-muted">
                A JSON copy of your account, portfolio and listings (password hash excluded).
              </p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportData}>
              <Icon name="download" />
              Download
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[13px] font-semibold text-danger">Delete account</p>
              <p className="text-xs text-muted">
                Permanently removes your account, public portfolio, listings and enquiries from the platform.
              </p>
            </div>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDelOpen(true)}>
              <Icon name="trash3" />
              Delete account
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          Need to clear your workspace?{' '}
          <button type="button" className="underline" onClick={reset}>
            Clear workspace data
          </button>{' '}
          from Supabase.
        </p>
      </div>
      {delOpen && <DeleteModal open onClose={() => setDelOpen(false)} />}
    </section>
  );
}

/* ---------- Privacy ---------- */
function Privacy({ user }) {
  const { toast } = useFeedback();
  const [pv, setPv] = useState(() => {
    const o = {};
    PRIV.forEach(([k]) => (o[k] = (user.privacy || {})[k] !== false));
    return o;
  });
  const [note, setNote] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const u = currentUser();
    u.privacy = { ...(u.privacy || {}), ...pv };
    saveUser(u);
    setNote('Saved just now');
    toast('Privacy settings saved — your public portfolio is updated.');
  };
  return (
    <form className="card p-5 sm:p-7" onSubmit={submit}>
      <h2 className="h3">Privacy</h2>
      <p className="mt-1 text-[13px] text-muted">
        Choose which professional details appear on your public portfolio and listings. Your personal email and mobile
        are never shown.
      </p>
      <ul className="mt-6 divide-y divide-line rounded-lg border border-line">
        {PRIV.map(([k, label, desc]) => (
          <ToggleRow
            key={k}
            id={'pv-' + k}
            label={label}
            description={desc}
            checked={pv[k]}
            onChange={(v) => setPv({ ...pv, [k]: v })}
          />
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-end gap-3">
        <span className="text-xs text-muted">{note}</span>
        <button type="submit" className="btn btn-dark">
          Save privacy settings
        </button>
      </div>
    </form>
  );
}

/* ---------- Preferences ---------- */
function Preferences({ user }) {
  const { toast } = useFeedback();
  const pr = user.prefs || {};
  const [f, setF] = useState({
    language: pr.language || 'English',
    currency: pr.currency || 'AED',
    contact: pr.contact || 'email',
  });
  const [nt, setNt] = useState(() => {
    const n = user.notifications || {};
    const o = {};
    NOTIF.forEach(([k]) => (o[k] = n[k] !== false && (k !== 'product' || !!n.product)));
    return o;
  });
  const [note, setNote] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const u = currentUser();
    u.prefs = { ...f };
    u.notifications = { ...nt };
    saveUser(u);
    setNote('Saved just now');
    toast('Preferences saved.');
  };
  return (
    <form className="card p-5 sm:p-7" onSubmit={submit}>
      <h2 className="h3">Preferences</h2>
      <p className="mt-1 text-[13px] text-muted">
        How Emirate08 communicates with you. In this demo, preferences are saved but no messages are sent.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Field id="pr-lang" label="Language">
          <select id="pr-lang" className="select" value={f.language} onChange={set('language')}>
            <option>English</option>
            <option disabled>العربية (coming soon)</option>
          </select>
        </Field>
        <Field id="pr-cur" label="Preferred currency" hint="USD uses the fixed AED peg (3.6725).">
          <select id="pr-cur" className="select" value={f.currency} onChange={set('currency')}>
            <option value="AED">AED only</option>
            <option value="USD">AED with USD equivalent</option>
          </select>
        </Field>
        <Field id="pr-contact" label="Contact me by">
          <select id="pr-contact" className="select" value={f.contact} onChange={set('contact')}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </Field>
      </div>
      <h3 className="h4 mt-8">Notifications</h3>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
        {NOTIF.map(([k, label, desc]) => (
          <ToggleRow
            key={k}
            id={'n-' + k}
            label={label}
            description={desc}
            checked={nt[k]}
            onChange={(v) => setNt({ ...nt, [k]: v })}
          />
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-end gap-3">
        <span className="text-xs text-muted">{note}</span>
        <button type="submit" className="btn btn-dark">
          Save preferences
        </button>
      </div>
    </form>
  );
}

/* ---------- Plan summary ---------- */
function PlanSummary({ user }) {
  const p = plan(user);
  const c = counts(user);
  const tiles = [
    ['Current plan', p.name + (user.trial ? ' (trial)' : '')],
    ['Published listings', c.published + ' / ' + (p.listings || 'flexible')],
    ['Trial ends', user.trial ? fmtDate(user.trialEnds) : '—'],
  ];
  return (
    <section className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="h3">Subscription &amp; plan</h2>
          <p className="mt-1 text-[13px] text-muted">
            Pricing is still to be confirmed — nothing is charged in this demo.
          </p>
        </div>
        <Link className="btn btn-dark" href="/subscription">
          <Icon name="arrow-up-circle" />
          Compare &amp; upgrade
        </Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="kpi">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1.5 font-display text-[18px] font-semibold text-ink">{v}</p>
          </div>
        ))}
      </div>
      <h3 className="h4 mt-8">Plan benefits</h3>
      <ul className="mt-3 grid gap-2 text-[14px] sm:grid-cols-2">
        {p.features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Icon name="check2" className="h-4 w-4 text-sage-ink" />
            {f}
          </li>
        ))}
      </ul>
      <h3 className="h4 mt-8">Billing history</h3>
      <p className="mt-2 rounded-lg border border-dashed border-line p-4 text-[13px] text-muted">
        No invoices yet — your account is on a free trial.
      </p>
    </section>
  );
}

/** Private account settings (old account.html + dashboard.js account part). */
export function Account() {
  useStoreVersion();
  const [tab, go] = useHashTabs(TABS);
  const user = currentUser();
  const cs = credText(user);
  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage font-display text-[18px] font-semibold text-ink">
          {initialsOf(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[.12em] text-muted uppercase">Account · private</p>
          <h1 className="h2 text-[24px] lg:text-[28px]">{user.name}</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {user.type === 'agency' ? 'Agency account' : 'Licensed broker'} · Member since {fmtDate(user.createdAt)}
          </p>
        </div>
        <span className={'badge ' + cs[1]}>{'Credentials ' + cs[0].toLowerCase()}</span>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-white px-4 py-3 text-[13px] text-text">
        <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Settings on this page are never shown publicly. To change what buyers see, edit your{' '}
          <Link className="link" href="/profile">
            public portfolio
          </Link>
          .
        </span>
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <SectionNav label="Account sections" items={NAV} current={tab} onSelect={go} />
        <div className="min-w-0">
          <div hidden={tab !== 'personal'}>
            <Personal user={user} />
          </div>
          <div hidden={tab !== 'credentials'}>
            <Credentials user={user} />
          </div>
          <div hidden={tab !== 'security'}>
            <Security user={user} />
          </div>
          <div hidden={tab !== 'privacy'}>
            <Privacy user={user} />
          </div>
          <div hidden={tab !== 'preferences'}>
            <Preferences user={user} />
          </div>
          <div hidden={tab !== 'plan'}>
            <PlanSummary user={user} />
          </div>
        </div>
      </div>
    </div>
  );
}
