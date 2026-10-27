'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@/components/layout/Wordmark';
import { Icon } from '@/components/ui/Icon';

type Stats = Record<string, number>;
type Member = {
  id: string | number;
  name: string;
  email: string;
  accountType: string;
  credentialStatus: string;
  adminCreated: boolean;
  adminAccess: boolean;
  isSuspended?: boolean;
  controlRole?: string;
  mobile?: string;
  profile?: Record<string, any>;
};
type Staff = {
  id: string | number;
  name: string;
  email: string;
  controlRole: 'subadmin' | 'verifier';
  adminCreated: boolean;
  adminAccess: boolean;
  isSuspended?: boolean;
};
type Property = {
  id: string | number;
  title: string;
  ref?: string;
  status: string;
  purpose?: string;
  area?: string;
  visible: boolean;
  verification: {
    ready: boolean;
    checks: { key: string; label: string; submitted: string; evidence: any; ok: boolean }[];
  };
};

const cards = [
  ['members', 'Members', 'people'],
  ['pendingMembers', 'Pending verifications', 'person-check'],
  ['publishedProperties', 'Live listings', 'building'],
  ['newEnquiries', 'New enquiries', 'inbox'],
  ['brokers', 'Broker profiles', 'briefcase'],
  ['media', 'Media assets', 'images'],
];

function memberEvidence(member: Member) {
  const profile = member.profile || {};
  const credentials = profile.credentials && typeof profile.credentials === 'object' ? profile.credentials : {};
  const credentialValue = Object.entries(credentials)
    .filter(([key, value]) => value && !/file$/i.test(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
  const evidenceFile = credentials.cardFile || credentials.licenceFile;
  return [
    {
      label: 'Identity',
      submitted: `${member.name || 'Name missing'} · ${profile.legalName || 'Legal name not supplied'}`,
      evidence: 'No identity document was uploaded during registration',
      ok: Boolean(member.name && profile.legalName),
    },
    {
      label: 'Contact',
      submitted: `${member.email || 'Email missing'} · ${member.mobile || 'Mobile missing'}`,
      evidence: 'Registration contact fields (no separate document)',
      ok: Boolean(member.email && member.mobile),
    },
    {
      label: 'Professional credentials',
      submitted: credentialValue || 'No credential values supplied',
      evidence: evidenceFile || 'No RERA card or trade licence file selected',
      ok:
        member.accountType === 'buyer' ||
        member.accountType === 'developer' ||
        Boolean(credentialValue && (credentials.cardFile || credentials.licenceFile)),
    },
    {
      label: 'Profile readiness',
      submitted: profile.portfolio?.displayName || profile.portfolio?.title || 'Professional profile not started',
      evidence: profile.portfolio ? 'Professional profile data is present' : 'No professional profile evidence yet',
      ok: member.accountType === 'buyer' || member.accountType === 'developer' || Boolean(profile.portfolio),
    },
  ];
}

function brokerEvidence(member: Member) {
  const profile = member.profile || {};
  const credentials = profile.credentials && typeof profile.credentials === 'object' ? profile.credentials : {};
  const cardFile = credentials.cardFile;
  return [
    {
      label: 'Full Name',
      submitted: member.name || profile.legalName || 'Name missing',
      ok: Boolean(member.name || profile.legalName),
    },
    {
      label: 'RERA BRN',
      submitted: credentials.brn || 'BRN not supplied',
      ok: Boolean(credentials.brn),
    },
    {
      label: 'RERA Expire Date',
      submitted: credentials.expiry || 'Expiry date not supplied',
      ok: Boolean(credentials.expiry),
    },
  ].map((check) => ({ ...check, evidence: cardFile || 'No RERA card uploaded' }));
}

function EvidenceView({ value }: { value: any }) {
  if (!value || typeof value !== 'object' || !value.url) return <>{value || 'Not supplied'}</>;
  const image = /image\//i.test(value.mimetype || '') || /\.(jpe?g|png)$/i.test(value.filename || '');
  return (
    <div className="space-y-2">
      <a href={value.url} target="_blank" rel="noreferrer" className="link break-all">
        {value.filename || 'Open uploaded evidence'}
      </a>
      {image ? (
        <img
          src={value.url}
          alt={value.filename || 'Uploaded evidence'}
          className="max-h-48 w-full rounded-lg border border-line object-contain"
        />
      ) : (
        <iframe
          title={value.filename || 'Uploaded evidence'}
          src={value.url}
          className="h-48 w-full rounded-lg border border-line"
        />
      )}
    </div>
  );
}

async function control(action: string, payload = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    return { error: response.ok ? 'The server returned an invalid response.' : `The request failed (${response.status}). Please retry.` };
  }
}

export default function ControlRoomPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [verificationTab, setVerificationTab] = useState<'identity' | 'property'>('identity');
  const [tableVisible, setTableVisible] = useState(true);
  const tableTransitionTimer = useRef<number | null>(null);
  const [section, setSection] = useState<
    'overview' | 'verification' | 'property-verification' | 'properties' | 'accounts'
  >('overview');
  const [newMember, setNewMember] = useState({ name: '', email: '', controlRole: 'subadmin' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadDashboard = async () => {
    const dashboard = await control('dashboard');
    if (dashboard.stats) setStats(dashboard.stats);
    setMembers(dashboard.members || []);
    setStaff(dashboard.staff || []);
    setProperties(dashboard.properties || []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await control('session');
        if (session.user) {
          if (session.user.mustChangePassword) {
            router.replace('/change-password?next=%2Fcontrol-room');
            return;
          }
          setUser(session.user);
          if (session.user.role === 'verifier') setSection('verification');
          await loadDashboard();
        } else {
          router.replace('/login?next=%2Fcontrol-room');
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => () => {
    if (tableTransitionTimer.current !== null) window.clearTimeout(tableTransitionTimer.current);
  }, []);

  const updateMember = async (id: Member['id'], patch: Record<string, unknown>) => {
    const result = await control('update-member', { id, ...patch });
    if (result.error) return setError(result.error);
    setNotice('Member access and verification status updated.');
    await loadDashboard();
  };

  const updateProperty = async (id: Property['id'], patch: Record<string, unknown>) => {
    const result = await control('update-property', { id, ...patch });
    if (result.error) return setError(result.error);
    setNotice(patch.verificationDecision ? 'Property verification decision saved.' : 'Property status updated.');
    await loadDashboard();
  };

  const createMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await control('create-member', newMember);
    setBusy(false);
    if (result.error) return setError(result.error);
    setNewMember({ name: '', email: '', controlRole: 'subadmin' });
    setNotice('Admin-created member added. Temporary sign-in credentials were emailed to the new user.');
    await loadDashboard();
  };

  const accountAction = async (account: Member | Staff, actionType: 'suspend' | 'unsuspend' | 'delete') => {
    const kind = 'accountType' in account ? 'member' : 'staff';
    if (actionType === 'delete' && !window.confirm(`Permanently delete ${account.name} (${account.email})? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    const result = await control('account-action', { id: account.id, kind, actionType });
    if (result.error) return setError(result.error);
    setNotice(actionType === 'delete' ? 'Account deleted.' : actionType === 'suspend' ? 'Account suspended.' : 'Account reactivated.');
    await loadDashboard();
  };

  if (!user) return <main className="min-h-screen bg-ink-deep" aria-busy="true" />;

  const verified = stats ? Math.max(0, stats.members - stats.pendingMembers) : 0;
  const verificationRate = stats?.members ? Math.round((verified / stats.members) * 100) : 0;
  const tab = (key: typeof section, label: string, icon: string) => (
    <button
      onClick={() => {
        setSection(key);
        setError('');
        setNotice('');
      }}
      className={`btn btn-sm ${section === key ? 'btn-dark' : 'btn-outline'}`}
    >
      <Icon name={icon} /> {label}
    </button>
  );
  const verificationTabs = (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-paper p-1" role="tablist" aria-label="Verification type">
      {([
        ['identity', 'Identity'],
        ['property', 'Property'],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={verificationTab === value}
          className={`btn btn-sm ${verificationTab === value ? 'btn-dark' : 'btn-outline'}`}
          onClick={() => {
            if (value === verificationTab) return;
            if (tableTransitionTimer.current !== null) window.clearTimeout(tableTransitionTimer.current);
            setTableVisible(false);
            tableTransitionTimer.current = window.setTimeout(() => {
              setVerificationTab(value);
              tableTransitionTimer.current = window.setTimeout(() => setTableVisible(true), 20);
            }, 180);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f5f6f2] text-ink">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-5 sm:px-10">
        <Wordmark href="/control-room" label="Emirate08 Control Room" />
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-muted sm:inline">{user.name}</span>
          <span className="badge badge-warn capitalize">{user.role}</span>
          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              await control('logout');
              // Hard navigation clears the protected control-room session before entering the public site.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = '/';
            }}
          >
            <Icon name="box-arrow-right" /> Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-[1380px] px-5 py-8 sm:px-10 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-sage-deep">Platform operations</p>
            <h1 className="h1 mt-2 text-[38px]">
              Control <em className="f font-normal">Room.</em>
            </h1>
            <p className="mt-2 text-sm text-muted">Approvals, property operations and account management.</p>
          </div>
          <span className="badge badge-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> System healthy
          </span>
        </div>
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Control Room sections">
          {user.role !== 'verifier' && tab('overview', 'Overview', 'grid-1x2')}
          {tab('verification', 'Verifications', 'person-check')}
          {user.role !== 'verifier' && tab('properties', 'Properties', 'building')}
          {user.role !== 'verifier' && tab('accounts', 'Accounts', 'people')}
        </nav>
        {error && (
          <p
            className="mt-5 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-5 rounded-lg border border-sage/30 bg-sage/10 px-4 py-3 text-sm" role="status">
            {notice}
          </p>
        )}

        {section === 'overview' && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map(([key, label, icon]) => (
                <article key={key} className="rounded-xl border border-line bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-muted">{label}</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-mist text-ink">
                      <Icon name={icon} />
                    </span>
                  </div>
                  <p className="mt-5 font-display text-[32px] font-semibold">{stats?.[key] ?? 0}</p>
                </article>
              ))}
            </section>
            <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
              <article className="rounded-xl border border-line bg-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="eyebrow">Verification queue</p>
                    <h2 className="mt-2 font-display text-xl font-semibold">Member credentials</h2>
                  </div>
                  <span className="badge badge-warn">{stats?.pendingMembers ?? 0} awaiting review</span>
                </div>
                <div className="mt-8 flex items-center gap-8">
                  <div
                    className="relative h-36 w-36 shrink-0 rounded-full"
                    style={{ background: `conic-gradient(#9bb7a4 ${verificationRate}%, #e7ebe5 0)` }}
                  >
                    <div className="absolute inset-3 flex items-center justify-center rounded-full bg-white">
                      <span className="font-display text-3xl font-semibold">{verificationRate}%</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p>
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-sage" />
                      {verified} verified or cleared
                    </p>
                    <p>
                      <span className="bg-amber-400 mr-2 inline-block h-2 w-2 rounded-full" />
                      {stats?.pendingMembers ?? 0} pending review
                    </p>
                    <button className="btn btn-dark btn-sm mt-2" onClick={() => setSection('verification')}>
                      Review verifications <Icon name="arrow-right" />
                    </button>
                  </div>
                </div>
              </article>
              <article className="rounded-xl border border-line bg-ink-deep p-6 text-white">
                <p className="eyebrow text-sage">Operations</p>
                <h2 className="mt-2 font-display text-xl text-white/40 font-semibold">Everything stays in Control Room.</h2>
                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => setSection('properties')}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-left text-sm hover:bg-white/5"
                  >
                    <span>Manage properties</span>
                    <Icon name="arrow-right" className="text-sage" />
                  </button>
                  <button
                    onClick={() => setSection('accounts')}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-left text-sm hover:bg-white/5"
                  >
                    <span>Manage accounts</span>
                    <Icon name="arrow-right" className="text-sage" />
                  </button>
                </div>
              </article>
            </section>
          </>
        )}

        {section === 'verification' && verificationTab === 'identity' && (
          <section className="mt-6 rounded-xl border border-line bg-white p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Identity verification</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">Review member credentials</h2>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="badge badge-warn">{stats?.pendingMembers ?? 0} pending</span>
                {verificationTabs}
              </div>
            </div>
            <div className={`mt-6 overflow-x-auto transition-opacity duration-200 motion-reduce:transition-none ${tableVisible ? 'opacity-100' : 'opacity-0'}`}>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-3 py-3">Member</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Control access</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.filter((member) => !member.controlRole).map((member) => (
                    <tr key={member.id} className="border-b border-line/70">
                      <td className="px-3 py-4">
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs text-muted">{member.email}</p>
                      </td>
                      <td className="px-3 py-4 capitalize">{member.controlRole || member.accountType}</td>
                      <td className="px-3 py-4">
                        <span
                          className={`badge ${member.credentialStatus === 'verified' ? 'badge-ok' : member.credentialStatus === 'rejected' ? 'badge-danger' : 'badge-warn'}`}
                        >
                          {member.credentialStatus}
                        </span>
                      </td>
                      <td className="px-3 py-4">{member.adminAccess ? 'Enabled' : 'Off'}</td>
                      <td className="px-3 py-4">
                        <div className="flex gap-2">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => router.push(`/control-room/verification/${member.id}`)}
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(section === 'property-verification' || (section === 'verification' && verificationTab === 'property')) && (
          <section className={`mt-6 space-y-5 transition-opacity duration-200 motion-reduce:transition-none ${section !== 'verification' || tableVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className="rounded-xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Property verification</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold">Compare listing data with evidence</h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="badge badge-warn">{properties.length} listings</span>
                  {section === 'verification' && verificationTabs}
                </div>
              </div>
             
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
                    <tr>
                      <th className="px-3 py-3">Property</th>
                      <th className="px-3 py-3">Reference / area</th>
                      <th className="px-3 py-3">Listing status</th>
                      <th className="px-3 py-3">Verification</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((property) => (
                      <tr key={property.id} className="border-b border-line/70">
                        <td className="px-3 py-4">
                          <p className="font-semibold">{property.title}</p>
                          <p className="text-xs text-muted">Property listing</p>
                        </td>
                        <td className="px-3 py-4">
                          <p>{property.ref || 'No reference'}</p>
                          <p className="text-xs text-muted">{property.area || 'Area missing'}</p>
                        </td>
                        <td className="px-3 py-4 capitalize">{property.status}</td>
                        <td className="px-3 py-4">
                          <span className={`badge ${property.verification.ready ? 'badge-ok' : 'badge-warn'}`}>
                            {property.verification.ready ? 'Ready to approve' : 'Evidence incomplete'}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => router.push(`/control-room/property-verification/${property.id}`)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {false && properties.map((property) => (
              <article id={`property-review-${property.id}`} key={property.id} className="rounded-xl border border-line bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-xl font-semibold">{property.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {property.ref || 'No reference'} · {property.area || 'Area missing'} · {property.status}
                    </p>
                  </div>
                  <span className={`badge ${property.verification.ready ? 'badge-ok' : 'badge-warn'}`}>
                    {property.verification.ready ? 'Ready to approve' : 'Evidence incomplete'}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {property.verification.checks.map((check) => (
                    <div
                      key={check.key}
                      className={`rounded-lg border p-4 ${check.ok ? 'border-sage/30 bg-sage/10' : 'border-amber-300/50 bg-amber-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">{check.label}</p>
                        <Icon
                          name={check.ok ? 'check-circle' : 'exclamation-circle'}
                          className={check.ok ? 'text-sage-deep' : 'text-amber-700'}
                        />
                      </div>
                      <p className="mt-3 text-xs text-ink">
                        Filled data: <span className="font-semibold">{check.submitted}</span>
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        Evidence required: {typeof check.evidence === 'object' ? 'Uploaded permit document' : check.evidence}
                      </p>
                      {typeof check.evidence === 'object' && (
                        <div className="mt-3 rounded-lg border border-line bg-white p-3">
                          <EvidenceView value={check.evidence} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                  <button
                    className="btn btn-dark btn-sm"
                    disabled={!property.verification.ready}
                    onClick={() => updateProperty(property.id, { verificationDecision: 'approved' })}
                  >
                    Approve property <Icon name="check-lg" />
                  </button>
                  <button
                    className="btn btn-outline btn-sm text-danger"
                    onClick={() => updateProperty(property.id, { verificationDecision: 'needs_changes' })}
                  >
                    Request changes
                  </button>
                  {user.role !== 'verifier' && (
                    <button className="btn btn-outline btn-sm" onClick={() => setSection('properties')}>
                      Open property management
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        {section === 'properties' && (
          <section className="mt-6 rounded-xl border border-line bg-white p-6">
            <div>
              <p className="eyebrow">Property management</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">Listings and visibility</h2>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3">Area</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Visibility</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((property) => (
                    <tr key={property.id} className="border-b border-line/70">
                      <td className="px-3 py-4">
                        <p className="font-semibold">{property.title}</p>
                        <p className="text-xs text-muted">
                          {property.ref || 'No reference'} · {property.purpose || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-4">{property.area || '—'}</td>
                      <td className="px-3 py-4">
                        <select
                          className="input h-9 min-w-[145px] py-1"
                          value={property.status}
                          onChange={(e) => updateProperty(property.id, { status: e.target.value })}
                        >
                          <option value="draft">Draft</option>
                          <option value="pending">Pending</option>
                          <option value="published">Published</option>
                          <option value="unpublished">Unpublished</option>
                          <option value="sold">Sold</option>
                          <option value="rented">Rented</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                      <td className="px-3 py-4">
                        <button
                          className={`badge ${property.visible ? 'badge-ok' : 'badge-warn'}`}
                          onClick={() => updateProperty(property.id, { visible: !property.visible })}
                        >
                          {property.visible ? 'Visible' : 'Hidden'}
                        </button>
                      </td>
                      <td className="px-3 py-4">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => updateProperty(property.id, { status: 'published' })}
                        >
                          Publish
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {section === 'accounts' && (
          <section className="mt-6 grid grid-cols-1 gap-6">
            <form onSubmit={createMember} className="rounded-xl border border-line bg-white p-6">
              <p className="eyebrow">Control Room access</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">Create subadmin or verifier</h2>
              <p className="mt-2 text-sm text-muted">
                Only Control Room staff can be created here. A secure temporary password will be generated and emailed
                to the new user.
              </p>
              <div className="mt-6 space-y-3">
                <input
                  className="input"
                  placeholder="Full name"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                />
                <input
                  className="input"
                  type="email"
                  placeholder="Email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                />
                <select
                  className="input"
                  value={newMember.controlRole}
                  onChange={(e) => setNewMember({ ...newMember, controlRole: e.target.value })}
                >
                  <option value="subadmin">Subadmin — full Control Room access</option>
                  <option value="verifier">Verifier — verification only</option>
                </select>
                <button className="btn btn-dark btn-lg w-full" disabled={busy}>
                  Create account
                </button>
              </div>
            </form>
            <div className="rounded-xl border border-line bg-white p-6">
              <p className="eyebrow">Access directory</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">Approved and registered accounts</h2>
              <div className="mt-6 space-y-3">
                {[
                  ...staff,
                  ...members.filter((member) => !member.adminCreated),
                ].map((member) => (
                  <div
                    key={`${'accountType' in member ? 'member' : 'staff'}-${member.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4"
                  >
                    <div>
                      <p className="font-semibold">{member.name}</p>
                      <p className="text-xs text-muted">
                        {member.email} · {member.controlRole || ('accountType' in member ? member.accountType : 'Control Room staff')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${member.adminAccess ? 'badge-ok' : 'badge-warn'}`}>
                        {member.adminAccess ? 'Control access' : 'No control access'}
                      </span>
                      {member.isSuspended && <span className="badge badge-danger">Suspended</span>}
                      {member.adminCreated && 'accountType' in member && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => updateMember(member.id, { adminAccess: !member.adminAccess })}
                        >
                          {member.adminAccess ? 'Disable' : 'Enable'}
                        </button>
                      )}
                      {['admin', 'subadmin'].includes(user.role) && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => accountAction(member, member.isSuspended ? 'unsuspend' : 'suspend')}>
                            {member.isSuspended ? 'Reactivate' : 'Suspend'}
                          </button>
                          <button className="btn btn-outline btn-sm text-danger" onClick={() => accountAction(member, 'delete')}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
