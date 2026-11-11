'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AiDocumentInput, AiProgress } from '@/components/ui/AiAssist';

type Suggestions = Record<string, unknown>;
type SourceResult = { label: string; suggestions: Suggestions };
type Candidate = { value: unknown; sources: string[] };
type Props = { profile: Record<string, any>; onApply: (suggestions: Suggestions, selected: string[], candidates?: Record<string, Candidate[]>) => void; onClose?: () => void; id?: string; kind?: 'profile' | 'listing' };

function comparable(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item: any) => typeof item === 'object' && item
      ? `${item.label || ''}:${item.value || ''}`.trim().toLowerCase()
      : String(item).trim().toLowerCase()).sort().join('|');
  }
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function collectCandidates(sources: SourceResult[] | null) {
  const result: Record<string, Candidate[]> = {};
  for (const source of sources || []) {
    if (!source || !source.suggestions || typeof source.suggestions !== 'object' || Array.isArray(source.suggestions)) continue;
    for (const [key, value] of Object.entries(source.suggestions)) {
      result[key] ||= [];
      const existing = result[key].find((candidate) => comparable(candidate.value) === comparable(value));
      if (existing) existing.sources.push(source.label);
      else result[key].push({ value, sources: [source.label] });
    }
  }
  return result;
}

export function ProfileAutofill({ profile, onApply, onClose, id = 'profile-ai-intake', kind = 'profile' }: Props) {
  const listing = kind === 'listing';
  const [website, setWebsite] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); };

  const reset = () => {
    setWebsite(''); setFiles([]); setWarnings([]); setError('');
  };

  const analyze = async () => {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true); setError(''); setWarnings([]);
    try {
      const form = new FormData();
      if (website.trim()) form.set('website', website.trim());
      for (const file of files) form.append('files', file);
      form.set('profile', JSON.stringify(profile));
      const response = await fetch(listing ? '/api/listing-autofill' : '/api/profile-autofill', { method: 'POST', body: form, credentials: 'same-origin', signal: controller.signal });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || 'Could not analyze the resource.');
      if (!Array.isArray(result.sources)) throw new Error(result.error || 'The AI response did not include any resource results. Please try again.');
      const analyzed = result.sources.filter((source: any) => source && typeof source.label === 'string' && source.suggestions && typeof source.suggestions === 'object' && !Array.isArray(source.suggestions)) as SourceResult[];
      if (!analyzed.length) throw new Error('No details could be read from that resource. Try a clearer document or another source.');
      const candidates = collectCandidates(analyzed);
      const chosen: Suggestions = {};
      for (const [key, values] of Object.entries(candidates)) chosen[key] = values[0].value;
      if (!Object.keys(chosen).length) throw new Error('No profile or listing details could be read from those resources. Try a clearer document or another source.');
      onApply(chosen, Object.keys(chosen), candidates);
      setWarnings(result.warnings || []);
      onClose?.();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not analyze the resource.');
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };


  return (
    <section id={id} className="scroll-mt-24 mt-[20px] rounded-lg border border-[#c6c5f5] border-l-4 border-l-[#6959dc] bg-white p-4 shadow-sm sm:p-6" aria-labelledby={`${id}-title`} aria-busy={busy}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><h3 id={`${id}-title`} className="h4">{listing ? 'Add your property documents' : 'What should AI read?'}</h3>
        <p className="mt-1 text-[13px] text-muted">{listing ? 'AI reads classification, location, size, price and terms. Photos and your permit details stay with you.' : 'Upload up to eight CVs, broker profiles or credential documents, or use one public profile page.'}</p></div>
        {onClose && <button className="btn btn-ghost btn-sm" type="button" aria-label="Close document assistance" onClick={() => { cancel(); onClose(); }}><Icon name="x-lg" /></button>}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <AiDocumentInput files={files} onChange={setFiles} disabled={busy || Boolean(website.trim())} onError={setError} />
        {listing ? <div><p className="label">Works best with</p><ul className="list-disc pl-5 text-[13px] leading-7 text-text"><li>Title deed or Oqood / SPA</li><li>Floor plan with areas</li><li>Developer brochure or fact sheet</li><li>Form A or tenancy contract</li></ul><p className="hint">These documents are used to prepare suggestions and are not added to the public listing.</p></div> : <div><p className="mb-3 flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or</p><label className="field"><span className="label">Public profile page</span><input className="input" type="url" placeholder="https://your-agency.com/team/you" value={website} disabled={busy || Boolean(files.length)} onChange={(event) => setWebsite(event.target.value)} /><span className="hint">Use either documents or one link per analysis.</span></label></div>}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex max-w-xl items-start gap-2 text-xs text-muted"><Icon name="lock" className="mt-0.5 shrink-0" />AI suggests details only. Existing entries are never replaced without your choice.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>Reset</button><button type="button" className="btn btn-dark" onClick={analyze} disabled={busy || (!website.trim() && !files.length)}><Icon name="stars" />{busy ? 'Reading resources…' : listing ? 'Read my documents' : 'Prepare my profile'}</button></div>
      </div>
      {busy && <AiProgress kind={listing ? 'listing' : 'profile'} title={listing ? 'Reading your property details…' : 'Preparing your profile…'} detail={files.length ? `Reading ${files.length} document${files.length === 1 ? '' : 's'}. This may take a minute or two.` : 'Reading your public profile page. This can take up to a minute.'} onCancel={cancel} />}
      {error && <div className="mt-4 flex items-start gap-3 rounded-md border border-danger/30 bg-danger-soft p-4 text-danger" role="alert"><Icon name="exclamation-circle" className="mt-0.5 shrink-0" /><div><b className="block text-sm">We couldn’t prepare these details</b><p className="mt-1 text-xs">{error}</p><p className="mt-1 text-xs">Try again or continue entering your details manually.</p></div></div>}
      {warnings.map((warning, index) => <p key={index} className="mt-3 text-sm text-warn" role="status">{warning}</p>)}
    </section>
  );
}
