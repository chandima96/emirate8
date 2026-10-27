'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession } from '@/components/providers/SessionProvider';

export function DeveloperOwnerCard({ listing, preview = false }) {
  const { user, role } = useSession();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  if (!listing.ownerDirect) return null;
  const owner = listing.owner?.name || listing.ownerDeveloper?.name || 'Property developer';
  const canClaim = listing.claimable && role === 'broker';
  const claim = async () => {
    setBusy(true);
    const response = await fetch('/api/role-workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create-claim', propertyId: listing.id }) });
    const result = await response.json();
    setBusy(false);
    setStatus(response.ok ? 'Request sent to the developer.' : result.error || 'Could not submit your request.');
  };
  return (
    <section className="mt-10 rounded-lg border border-sage/30 bg-sage-soft p-5" aria-labelledby="developer-owner-title">
      <p className="eyebrow">Developer direct</p>
      <h2 id="developer-owner-title" className="mt-2 font-display text-xl font-semibold text-ink">{owner}</h2>
      <p className="mt-2 text-sm text-muted">This property is published directly by the developer. Representation is assigned only after developer approval.</p>
      {listing.claimable && <p className="mt-2 text-sm font-semibold text-sage-ink">Open for approved broker representation.</p>}
      {!preview && canClaim && <button className="btn btn-dark mt-4" onClick={claim} disabled={busy}>{busy ? 'Sending…' : 'Request to represent'}</button>}
      {!preview && !user && listing.claimable && <Link className="btn btn-dark mt-4" href={`/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/' : window.location.pathname)}`}>Sign in to request representation</Link>}
      {status && <p className="mt-3 text-sm text-muted" role="status">{status}</p>}
    </section>
  );
}
