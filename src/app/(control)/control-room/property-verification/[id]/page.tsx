'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Wordmark } from '@/components/layout/Wordmark';

type Check = { key: string; label: string; submitted: string; evidence: any; ok: boolean };
type Property = {
  id: string | number;
  title: string;
  ref?: string;
  status: string;
  purpose?: string;
  area?: string;
  verification: { ready: boolean; checks: Check[] };
};

async function control(action: string, payload = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action, ...payload }),
  });
  return response.json();
}

function EvidenceView({ value }: { value: any }) {
  if (!value || typeof value !== 'object' || !value.url) {
    return <div className="flex min-h-48 items-center justify-center rounded-lg bg-mist p-6 text-sm text-muted">{value || 'No uploaded evidence available'}</div>;
  }
  const image = /image\//i.test(value.mimetype || '') || /\.(jpe?g|png)$/i.test(value.filename || '');
  if (!image) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg bg-mist p-6 text-center">
        <Icon name="file-check" className="text-sage-deep" />
        <p className="text-sm font-semibold">{value.filename || 'Advertising permit PDF'}</p>
        <p className="text-xs text-muted">PDF documents are available as downloads for clearer viewing.</p>
        <a href={value.url} download={value.filename || 'advertising-permit.pdf'} className="btn btn-dark btn-sm">
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '+' || event.key === '=') setZoom((current) => Math.min(3, current + 0.1));
      if (event.key === '-') setZoom((current) => Math.max(0.5, current - 0.1));
      if (event.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!viewportRef.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void viewportRef.current.requestFullscreen();
  };

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const pan = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !viewportRef.current) return;
    viewportRef.current.scrollLeft -= event.clientX - lastPointer.current.x;
    viewportRef.current.scrollTop -= event.clientY - lastPointer.current.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
  };

  const stopPan = (event: PointerEvent<HTMLDivElement>) => {
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) viewportRef.current.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-mist px-3 py-2">
        <p className="text-xs font-semibold text-muted">Document view · {Math.round(zoom * 100)}%</p>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))} aria-label="Zoom out">−</button>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Document zoom"
            className="w-28 accent-sage-deep sm:w-40"
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom((current) => Math.min(3, current + 0.1))} aria-label="Zoom in">+</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom(1)}>Fit</button>
          <a href={value.url} download={value.filename || 'advertising-permit'} className="btn btn-outline btn-sm">Download</a>
          <button type="button" className="btn btn-outline btn-sm" onClick={toggleFullscreen}>Fullscreen</button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`max-h-[72vh] min-h-[560px] overflow-auto rounded-lg border border-line bg-ink/5 p-2 ${dragging ? 'cursor-grabbing' : 'cursor-grab'} [&:fullscreen]:h-screen [&:fullscreen]:max-h-none`}
        onPointerDown={startPan}
        onPointerMove={pan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        style={{ touchAction: 'none' }}
      >
        <div className="origin-top-left" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: '100%', minHeight: zoom > 1 ? `${zoom * 100}%` : undefined }}>
          {image ? (
            <img src={value.url} alt={value.filename || 'Uploaded permit'} className="pointer-events-none w-full select-none rounded-lg object-contain" draggable={false} />
          ) : (
            <iframe title={value.filename || 'Uploaded permit'} src={value.url} className="pointer-events-none h-[72vh] min-h-[560px] w-full rounded-lg" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PropertyVerificationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [checkedFields, setCheckedFields] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void (async () => {
      const session = await control('session');
      if (!session.user) {
        router.replace(`/login?next=${encodeURIComponent(`/control-room/property-verification/${params.id}`)}`);
        return;
      }
      const dashboard = await control('dashboard');
      const found = (dashboard.properties || []).find((item: Property) => String(item.id) === String(params.id));
      if (!found) setError('This property could not be found.');
      else {
        setProperty(found);
        setCheckedFields(Object.fromEntries(found.verification.checks.map((check) => [check.key, false])));
      }
      setLoading(false);
    })();
  }, [params.id, router]);

  const decide = async (decision: 'approved' | 'needs_changes') => {
    if (!property) return;
    if (decision === 'approved' && !property.verification.checks.every((check) => checkedFields[check.key] === true)) {
      setError('Tick every verification field after comparing it with the submitted evidence.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await control('update-property', { id: property.id, verificationDecision: decision });
    setBusy(false);
    if (result.error) return setError(result.error);
    setNotice(decision === 'approved' ? 'Property verification approved.' : 'Property sent back for changes.');
    setProperty({ ...property, status: decision === 'approved' ? 'published' : 'pending' });
  };

  if (loading) return <main className="min-h-screen bg-paper" aria-busy="true" />;
  if (!property) {
    return (
      <main className="min-h-screen bg-paper px-5 py-8">
        <div className="mx-auto max-w-5xl">
          <Wordmark href="/control-room" label="Emirate08 Control Room" />
          <p className="mt-12 text-danger">{error || 'Property not found.'}</p>
          <button className="btn btn-outline mt-5" onClick={() => router.push('/control-room')}>Back to Control Room</button>
        </div>
      </main>
    );
  }

  const permitCheck = property.verification.checks.find((check) => check.key === 'permit');

  return (
    <main className="min-h-screen bg-paper px-5 py-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Wordmark href="/control-room" label="Emirate08 Control Room" />
          <button className="btn btn-outline" onClick={() => router.push('/control-room')}><Icon name="arrow-left" /> Back to verifications</button>
        </div>

        <header className="mt-12 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow text-sage-deep">Property verification review</p>
            <h1 className="mt-2 font-display text-4xl font-semibold">{property.title}</h1>
            <p className="mt-3 text-sm text-muted">Compare the listing values with the submitted permit and property evidence.</p>
          </div>
          <span className={`badge ${property.verification.ready ? 'badge-ok' : 'badge-warn'}`}>
            {property.verification.ready ? 'Ready to approve' : 'Evidence incomplete'}
          </span>
        </header>

        {notice && <p className="mt-5 rounded-lg bg-sage/10 p-3 text-sm text-sage-deep">{notice}</p>}
        {error && <p className="mt-5 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
            <p className="eyebrow">Uploaded property evidence</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">Advertising permit document</h2>
            <p className="mt-2 text-sm text-muted">Review the permit e-Certificate against the submitted permit number and expiry date.</p>
            <div className="mt-6"><EvidenceView value={permitCheck?.evidence} /></div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
            <p className="eyebrow">Submitted values</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">Property checks</h2>
            <p className="mt-2 text-sm text-muted">Tick each field only after confirming it against the evidence.</p>
            <div className="mt-6 space-y-3">
              {property.verification.checks.map((check) => (
                <label key={check.key} className={`block cursor-pointer rounded-lg border p-4 ${checkedFields[check.key] ? 'border-sage/30 bg-sage/10' : 'border-amber-300/50 bg-amber-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" className="h-5 w-5 accent-sage-deep" checked={checkedFields[check.key] === true} onChange={(event) => setCheckedFields((current) => ({ ...current, [check.key]: event.target.checked }))} />
                      <p className="font-semibold">{check.label}</p>
                    </div>
                    <Icon name={checkedFields[check.key] ? 'check-circle' : 'exclamation-circle'} className={checkedFields[check.key] ? 'text-sage-deep' : 'text-amber-700'} />
                  </div>
                  <p className="mt-2 text-[10px] font-semibold tracking-[.12em] text-muted uppercase">Filled during listing creation</p>
                  <p className="mt-1 text-sm font-semibold">{check.submitted}</p>
                  <p className="mt-2 text-xs text-muted">Evidence: {typeof check.evidence === 'object' ? check.evidence.filename || 'Uploaded document' : check.evidence}</p>
                </label>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
          <p className="eyebrow">Listing details</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div><p className="text-xs text-muted">Reference</p><p className="mt-1 font-semibold">{property.ref || 'Not supplied'}</p></div>
            <div><p className="text-xs text-muted">Area</p><p className="mt-1 font-semibold">{property.area || 'Not supplied'}</p></div>
            <div><p className="text-xs text-muted">Purpose</p><p className="mt-1 font-semibold capitalize">{property.purpose || 'Not supplied'}</p></div>
            <div><p className="text-xs text-muted">Listing status</p><p className="mt-1 font-semibold capitalize">{property.status}</p></div>
            <div><p className="text-xs text-muted">Checks passed</p><p className="mt-1 font-semibold">{property.verification.checks.filter((check) => check.ok).length} / {property.verification.checks.length}</p></div>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line py-6">
          <button className="btn btn-outline text-danger" disabled={busy} onClick={() => decide('needs_changes')}>Request changes</button>
          <button className="btn btn-dark" disabled={busy} onClick={() => decide('approved')}>{busy ? 'Saving…' : 'Verify property'} <Icon name="check-lg" /></button>
        </div>
      </div>
    </main>
  );
}
