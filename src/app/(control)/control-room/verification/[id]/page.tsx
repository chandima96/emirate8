'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Wordmark } from '@/components/layout/Wordmark';

type Member = {
  id: string | number;
  name: string;
  email: string;
  accountType: string;
  credentialStatus: string;
  adminCreated: boolean;
  mobile?: string;
  profile?: Record<string, any>;
};

type Check = { key: string; label: string; submitted: string; ok: boolean; evidence?: any };

async function control(action: string, payload = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action, ...payload }),
  });
  return response.json();
}

function brokerChecks(member: Member): Check[] {
  const profile = member.profile || {};
  const credentials = profile.credentials && typeof profile.credentials === 'object' ? profile.credentials : {};
  return [
    { key: 'fullName', label: 'Full Name', submitted: member.name || profile.legalName || 'Name missing', ok: Boolean(member.name) },
    { key: 'brn', label: 'RERA BRN', submitted: credentials.brn || 'BRN not supplied', ok: Boolean(credentials.brn) },
    {
      key: 'expiry',
      label: 'RERA Expire Date',
      submitted: credentials.expiry || 'Expiry date not supplied',
      ok: Boolean(credentials.expiry),
    },
  ];
}

function memberChecks(member: Member): Check[] {
  const profile = member.profile || {};
  const credentials = profile.credentials && typeof profile.credentials === 'object' ? profile.credentials : {};
  const credentialValue = Object.entries(credentials)
    .filter(([key, value]) => value && !/file$/i.test(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
  return [
    {
      key: 'identity',
      label: 'Identity',
      submitted: `${member.name || 'Name missing'} · ${profile.legalName || 'Legal name not supplied'}`,
      ok: Boolean(member.name && profile.legalName),
    },
    {
      key: 'contact',
      label: 'Contact',
      submitted: `${member.email || 'Email missing'} · ${member.mobile || 'Mobile missing'}`,
      ok: Boolean(member.email && member.mobile),
    },
    {
      key: 'credentials',
      label: 'Professional credentials',
      submitted: credentialValue || 'No credential values supplied',
      ok:
        member.accountType === 'buyer' ||
        member.accountType === 'developer' ||
        Boolean(credentialValue && (credentials.cardFile || credentials.licenceFile)),
    },
    {
      key: 'profile',
      label: 'Profile readiness',
      submitted: profile.portfolio?.displayName || profile.portfolio?.title || 'Professional profile not started',
      ok: member.accountType === 'buyer' || member.accountType === 'developer' || Boolean(profile.portfolio),
    },
  ];
}

function EvidenceView({ value }: { value: any }) {
  if (!value || typeof value !== 'object' || !value.url) {
    return <div className="flex min-h-48 items-center justify-center rounded-lg bg-mist p-6 text-sm text-muted">{value || 'No uploaded file available'}</div>;
  }
  const image = /image\//i.test(value.mimetype || '') || /\.(jpe?g|png)$/i.test(value.filename || '');
  if (!image) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg bg-mist p-6 text-center">
        <Icon name="file-check" className="text-sage-deep" />
        <p className="text-sm font-semibold">{value.filename || 'Uploaded PDF'}</p>
        <p className="text-xs text-muted">PDF documents are available as downloads for clearer viewing.</p>
        <a href={value.url} download={value.filename || 'uploaded-evidence.pdf'} className="btn btn-dark btn-sm">
          Download PDF <Icon name="download" />
        </a>
      </div>
    );
  }
  return <ZoomableDocument value={value} image />;
}

function ZoomableDocument({ value, image }: { value: any; image: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const documentViewport = useRef<HTMLDivElement>(null);
  const lastPointer = useRef({ x: 0, y: 0 });

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = documentViewport.current;
    if (!viewport) return;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const pan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const viewport = documentViewport.current;
    if (!viewport) return;
    viewport.scrollLeft -= event.clientX - lastPointer.current.x;
    viewport.scrollTop -= event.clientY - lastPointer.current.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
  };

  const stopPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = documentViewport.current;
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  return (
    <div className="space-y-3">
      <a href={value.url} target="_blank" rel="noreferrer" className="link break-all text-sm">
        Open {value.filename || 'uploaded evidence'} in a new tab
      </a>
      <div className="flex items-center justify-between rounded-lg border border-line bg-mist px-3 py-2">
        <p className="text-xs font-semibold text-muted">Document view · {Math.round(zoom * 100)}%</p>
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))} aria-label="Zoom out">
            −
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom(1)} aria-label="Reset zoom">
            Reset
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))} aria-label="Zoom in">
            +
          </button>
        </div>
      </div>
      <div
        ref={documentViewport}
        className={`max-h-[72vh] min-h-[560px] overflow-auto rounded-lg border border-line bg-ink/5 p-2 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={startPan}
        onPointerMove={pan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        style={{ touchAction: 'none' }}
      >
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: '100%',
            minHeight: zoom > 1 ? `${zoom * 100}%` : undefined,
          }}
        >
          {image ? (
            <img
              src={value.url}
              alt={value.filename || 'Uploaded evidence'}
              className="w-full rounded-lg object-contain pointer-events-none select-none"
              draggable={false}
            />
          ) : (
            <iframe
              title={value.filename || 'Uploaded evidence'}
              src={value.url}
              className="h-[72vh] min-h-[560px] w-full rounded-lg pointer-events-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function MemberVerificationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checkedFields, setCheckedFields] = useState<Record<string, boolean>>({});
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    void (async () => {
      const session = await control('session');
      if (!session.user) {
        router.replace(`/login?next=${encodeURIComponent(`/control-room/verification/${params.id}`)}`);
        return;
      }
      const dashboard = await control('dashboard');
      const found = (dashboard.members || []).find((item: Member) => String(item.id) === String(params.id));
      if (!found) setError('This member could not be found.');
      else {
        setMember(found);
        setCheckedFields(found.profile?.credentialReview?.checks || {});
        setRejectionReason(found.profile?.credentialReview?.reason || '');
      }
      setLoading(false);
    })();
  }, [params.id, router]);

  const decide = async (status: 'verified' | 'rejected') => {
    if (!member) return;
    if (status === 'rejected' && !rejectionReason.trim()) {
      setError('Enter a reason so the member knows what must be corrected.');
      return;
    }
    const checks = member.accountType === 'broker' ? brokerChecks(member) : memberChecks(member);
    if (status === 'verified' && !checks.every((check) => checkedFields[check.key] === true)) {
      setError('Tick every verification field after comparing it with the document.');
      return;
    }
    setBusy(true);
    setError('');
    const credentialReview = {
      checks: checkedFields,
      reason: status === 'rejected' ? rejectionReason.trim() : '',
    };
    const result = await control('update-member', { id: member.id, credentialStatus: status, credentialReview });
    setBusy(false);
    if (result.error) return setError(result.error);
    setNotice(status === 'verified' ? 'Member verification approved.' : 'Member verification rejected.');
    setMember({ ...member, credentialStatus: status, profile: { ...(member.profile || {}), credentialReview } });
  };

  if (loading) return <main className="min-h-screen bg-paper" aria-busy="true" />;
  if (!member) {
    return (
      <main className="min-h-screen bg-paper px-5 py-8">
        <div className="mx-auto max-w-5xl">
          <Wordmark href="/control-room" label="Emirate08 Control Room" />
          <p className="mt-12 text-danger">{error || 'Member not found.'}</p>
          <button className="btn btn-outline mt-5" onClick={() => router.push('/control-room')}>
            Back to Control Room
          </button>
        </div>
      </main>
    );
  }

  const credentials = member.profile?.credentials && typeof member.profile.credentials === 'object' ? member.profile.credentials : {};
  const checks = member.accountType === 'broker' ? brokerChecks(member) : memberChecks(member);

  return (
    <main className="min-h-screen bg-paper px-5 py-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Wordmark href="/control-room" label="Emirate08 Control Room" />
          <button className="btn btn-outline" onClick={() => router.push('/control-room')}>
            <Icon name="arrow-left" /> Back to verifications
          </button>
        </div>

        <header className="mt-12 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow text-sage-deep">Verification review</p>
            <h1 className="mt-2 font-display text-4xl font-semibold">{member.name}&apos;s evidence</h1>
            <p className="mt-3 text-sm text-muted">Compare the submitted registration values with the uploaded evidence.</p>
          </div>
          <span className={`badge ${member.credentialStatus === 'verified' ? 'badge-ok' : member.credentialStatus === 'rejected' ? 'badge-danger' : 'badge-warn'}`}>
            {member.credentialStatus}
          </span>
        </header>

        {notice && <p className="mt-5 rounded-lg bg-sage/10 p-3 text-sm text-sage-deep">{notice}</p>}
        {error && <p className="mt-5 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Uploaded evidence</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">
                  {member.accountType === 'broker' ? 'RERA card document' : 'Registration documents'}
                </h2>
              </div>
              <Icon name="file-check" className="text-sage-deep" />
            </div>
            <div className="mt-6">
              <EvidenceView value={member.accountType === 'broker' ? credentials.cardFile : credentials.cardFile || credentials.licenceFile} />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
            <p className="eyebrow">Submitted values</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">
              {member.accountType === 'broker' ? 'RERA card checks' : 'Member checks'}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {member.accountType === 'broker' ? 'Check these three values directly against the card.' : 'Review the submitted data and available evidence.'}
            </p>
            <div className="mt-6 space-y-3">
              {checks.map((check) => (
                <label key={check.key} className={`block cursor-pointer rounded-lg border p-4 ${checkedFields[check.key] ? 'border-sage/30 bg-sage/10' : 'border-amber-300/50 bg-amber-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-sage-deep"
                        checked={checkedFields[check.key] === true}
                        onChange={(event) => setCheckedFields((current) => ({ ...current, [check.key]: event.target.checked }))}
                      />
                      <p className="font-semibold">{check.label}</p>
                    </div>
                    <Icon name={checkedFields[check.key] ? 'check-circle' : 'exclamation-circle'} className={checkedFields[check.key] ? 'text-sage-deep' : 'text-amber-700'} />
                  </div>
                  <p className="mt-2 text-[10px] font-semibold tracking-[.12em] text-muted uppercase">Filled during registration</p>
                  <p className="mt-1 text-sm font-semibold">{check.submitted}</p>
                  {member.accountType === 'broker' && <p className="mt-2 text-xs text-muted">Compare with the RERA card shown beside this panel.</p>}
                </label>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">Tick a field only after confirming it matches the uploaded document.</p>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
          <p className="eyebrow">Account details</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted">Email</p><p className="mt-1 font-semibold">{member.email}</p></div>
            <div><p className="text-xs text-muted">Account type</p><p className="mt-1 font-semibold capitalize">{member.accountType}</p></div>
            <div><p className="text-xs text-muted">Mobile</p><p className="mt-1 font-semibold">{member.mobile || 'Not supplied'}</p></div>
            <div><p className="text-xs text-muted">Source</p><p className="mt-1 font-semibold">{member.adminCreated ? 'Admin-created account' : 'Website registration'}</p></div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
          <p className="eyebrow">Decision notes</p>
          <label className="mt-3 block text-sm font-semibold" htmlFor="rejection-reason">Rejection reason</label>
          <textarea
            id="rejection-reason"
            className="input mt-2 min-h-28 w-full resize-y"
            placeholder="Explain which document field or evidence needs correction."
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted">This message will be shown to the member in their account credentials panel if rejected.</p>
        </section>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line py-6">
          <button className="btn btn-outline text-danger" disabled={busy} onClick={() => decide('rejected')}>
            Reject with reason
          </button>
          <button className="btn btn-dark" disabled={busy} onClick={() => decide('verified')}>
            {busy ? 'Saving…' : 'Verify after review'} <Icon name="check-lg" />
          </button>
        </div>
      </div>
    </main>
  );
}
