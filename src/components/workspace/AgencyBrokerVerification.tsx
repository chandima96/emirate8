'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/providers/SessionProvider';
import { updateAccountAction } from '@/app/actions';
import { uploadRegistrationEvidence } from '@/lib/mediaClient';
import { refreshData } from '@/lib/store';

export function AgencyBrokerVerification() {
  const router = useRouter();
  const { user } = useSession();
  const credentials = user?.credentials || {};
  const [name, setName] = useState(user?.name || '');
  const [brn, setBrn] = useState(credentials.brn || '');
  const [expiry, setExpiry] = useState(credentials.expiry || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [card, setCard] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(user?.credentialStatus === 'pending' && !!credentials.brn && !!credentials.cardFile);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (name.trim().length < 3 || !/\s/.test(name.trim())) return setError('Enter your first and last name as shown on your RERA card.');
    if (!/^\d{3,8}$/.test(brn.trim())) return setError('Enter your BRN (numbers only).');
    if (!expiry || new Date(expiry) <= new Date()) return setError('Enter a future RERA card expiry date.');
    if (!mobile.trim()) return setError('Enter your mobile number.');
    if (!card && !credentials.cardFile) return setError('Upload a copy of your RERA card.');
    setBusy(true);
    try {
      const cardFile = card ? await uploadRegistrationEvidence(card, card.name) : credentials.cardFile;
      const result = await updateAccountAction({
        name: name.trim(),
        mobile: mobile.trim(),
        credentials: { ...credentials, brn: brn.trim(), expiry, cardFile },
        credentialStatus: 'pending',
      });
      if (!result.ok) throw new Error(result.error || 'Could not submit your credentials.');
      setSubmitted(true);
      await refreshData();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p className="eyebrow">Agency broker onboarding</p>
      <h1 className="h2 mt-2">Verify your broker credentials</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">Submit the same RERA details required from independent brokers. You can access the agency workspace while your credentials are reviewed, but you can’t add property listings until verification is complete.</p>
      {submitted && <div className="mt-6 rounded-lg border border-warn/30 bg-warn-soft p-4 text-sm">Your credentials are submitted and awaiting review. Property listings will unlock after approval.</div>}
      <form className="mt-6 space-y-5 rounded-xl border border-line bg-white p-5 sm:p-7" onSubmit={submit}>
        <label className="field"><span className="label">Full name (as shown on your RERA card)</span><input className="input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field"><span className="label">UAE mobile number</span><input className="input" type="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} required /></label>
        <label className="field"><span className="label">RERA BRN</span><input className="input" inputMode="numeric" value={brn} onChange={(event) => setBrn(event.target.value)} required /></label>
        <label className="field"><span className="label">RERA card expiry date</span><input className="input" type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} required /></label>
        <label className="field"><span className="label">RERA card document</span><input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setCard(event.target.files?.[0] || null)} />{credentials.cardFile && !card && <span className="hint">Previously submitted: {credentials.cardFile.filename || credentials.cardFile.name || 'RERA card'}</span>}<span className="hint">PDF, JPG or PNG, up to 10 MB.</span></label>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button className="btn btn-dark" type="submit" disabled={busy}>{busy ? 'Submitting…' : submitted ? 'Update and resubmit credentials' : 'Submit credentials for verification'}</button>
      </form>
    </main>
  );
}
