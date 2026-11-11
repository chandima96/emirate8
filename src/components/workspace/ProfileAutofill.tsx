'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AiDocumentInput, AiProgress } from '@/components/ui/AiAssist';
import { listingAiLabel } from '@/lib/listingAutofill';

type Suggestions = Record<string, unknown>;
type SourceResult = { label: string; suggestions: Suggestions };
type Candidate = { value: unknown; sources: string[] };
type Selection = { index?: number; enabled: boolean };
type Props = { profile: Record<string, any>; onApply: (suggestions: Suggestions, selected: string[]) => void; onClose?: () => void; id?: string; kind?: 'profile' | 'listing' };

const LABELS: Record<string, string> = {
  displayName: 'Public name', title: 'Professional title', headline: 'Headline', intro: 'Short introduction', bio: 'Biography',
  experience: 'Years of experience', languages: 'Languages', areas: 'Service locations', specialties: 'Expertise',
  publicEmail: 'Business email', publicPhone: 'Business phone', whatsapp: 'WhatsApp', agencyName: 'Agency name',
  agencyWebsite: 'Agency website', credentials: 'Credentials',
};

function asText(value: unknown) {
  if (value && typeof value === 'object' && 'raw' in value && 'unit' in value) return `${value.raw} ${value.unit}`;
  if (Array.isArray(value)) return value.map((item: any) => typeof item === 'object' && item ? `${item.label}${item.value ? ` (${item.value})` : ''}` : item).join(', ');
  if (typeof value === 'object' && value) return JSON.stringify(value);
  return String(value);
}

function currentValue(profile: Record<string, any>, key: string) {
  if (key === 'agencyName') return profile.agency?.name || '';
  if (key === 'agencyWebsite') return profile.agency?.website || '';
  return profile[key];
}

function comparable(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item: any) => typeof item === 'object' && item
      ? `${item.label || ''}:${item.value || ''}`.trim().toLowerCase()
      : String(item).trim().toLowerCase()).sort().join('|');
  }
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function statusOf(profile: Record<string, any>, key: string, value: unknown) {
  const current = currentValue(profile, key);
  const currentText = Array.isArray(current) ? current : current == null ? '' : String(current);
  if (!currentText.length) return 'New';
  return comparable(current) === comparable(value) ? 'Unchanged' : 'Changed';
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
  const labelOf = (key: string) => listing ? listingAiLabel(key) : LABELS[key] || key;
  const [website, setWebsite] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sources, setSources] = useState<SourceResult[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selection, setSelection] = useState<Record<string, Selection>>({});
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); };

  const reset = () => {
    setWebsite(''); setFiles([]); setSources(null); setWarnings([]); setSelection({}); setEdits({}); setError('');
  };

  const analyze = async () => {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true); setError(''); setSources(null); setWarnings([]); setSelection({}); setEdits({});
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
      const initial: Record<string, Selection> = {};
      for (const [key, values] of Object.entries(candidates)) {
        if (values.length > 1) initial[key] = { enabled: false };
        else initial[key] = { index: 0, enabled: statusOf(profile, key, values[0].value) === 'New' };
      }
      setSources(analyzed);
      setWarnings(result.warnings || []);
      setSelection(initial);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not analyze the resource.');
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };

  const candidates = collectCandidates(sources);
  const keys = Object.keys(candidates).filter((key) => candidates[key].length > 1 || statusOf(profile, key, candidates[key][0].value) !== 'Unchanged');
  const unresolvedConflicts = keys.some((key) => candidates[key].length > 1 && selection[key]?.index == null);
  const selectedKeys = keys.filter((key) => selection[key]?.enabled && selection[key]?.index != null);
  const editId = (key: string, index: number) => `${key}:${index}`;
  const editedValue = (key: string, index: number) => Object.prototype.hasOwnProperty.call(edits, editId(key, index)) ? edits[editId(key, index)] : candidates[key][index].value;
  const editorText = (key: string, value: unknown) => {
    if (key === 'credentials' && Array.isArray(value)) return value.map((item: any) => `${item.label || ''}${item.value ? ` | ${item.value}` : ''}`).join('\n');
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '');
  };
  const updateEdit = (key: string, index: number, text: string) => {
    const original = candidates[key][index].value;
    let value: unknown = text;
    if (key === 'credentials') value = text.split('\n').map((line) => {
      const [label, ...rest] = line.split('|');
      return { label: label.trim(), value: rest.join('|').trim(), verified: false };
    }).filter((item) => item.label);
    else if (Array.isArray(original)) value = text.split(',').map((item) => item.trim()).filter(Boolean);
    else if (typeof original === 'number') value = text === '' ? '' : Number(text);
    setEdits((current) => ({ ...current, [editId(key, index)]: value }));
  };
  const suggestionEditor = (key: string, index: number) => {
    const value = editedValue(key, index);
    if (listing && value && typeof value === 'object' && 'raw' in value && 'unit' in value) return <div className="mt-2 flex gap-2">
      <input className="input" inputMode="decimal" aria-label={`Edit suggested ${labelOf(key)}`} value={String(value.raw)} onChange={(event) => setEdits((current) => ({ ...current, [editId(key, index)]: { ...value, raw: event.target.value } }))} />
      <select className="select max-w-24" aria-label={`${labelOf(key)} unit`} value={String(value.unit)} onChange={(event) => setEdits((current) => ({ ...current, [editId(key, index)]: { ...value, unit: event.target.value } }))}><option value="sqft">sq ft</option><option value="sqm">sq m</option></select>
    </div>;
    const multiline = key === 'bio' || key === 'intro' || key === 'headline' || key === 'credentials' || key === 'description';
    return multiline ? <textarea className="textarea mt-2 min-h-16 text-sm" rows={key === 'bio' ? 4 : 2} value={editorText(key, value)} onChange={(event) => updateEdit(key, index, event.target.value)} aria-label={`Edit suggested ${labelOf(key)}`} />
      : <input className="input mt-2 h-9 text-sm" type={typeof candidates[key][index].value === 'number' ? 'number' : 'text'} value={editorText(key, value)} onChange={(event) => updateEdit(key, index, event.target.value)} aria-label={`Edit suggested ${labelOf(key)}`} />;
  };
  const applySelected = () => {
    const chosen: Suggestions = {};
    for (const key of selectedKeys) chosen[key] = editedValue(key, selection[key].index!);
    onApply(chosen, selectedKeys);
    setSources(null); setWarnings([]); setSelection({}); setEdits({});
  };

  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-[#c6c5f5] border-l-4 border-l-[#6959dc] bg-white p-4 shadow-sm sm:p-6" aria-labelledby={`${id}-title`} aria-busy={busy}>
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
      {busy && <AiProgress title={listing ? 'Reading your property details…' : 'Preparing your profile…'} detail={files.length ? `Reading ${files.length} document${files.length === 1 ? '' : 's'}. This may take a minute or two.` : 'Reading your public profile page. This can take up to a minute.'} onCancel={cancel} />}
      {error && <div className="mt-4 flex items-start gap-3 rounded-md border border-danger/30 bg-danger-soft p-4 text-danger" role="alert"><Icon name="exclamation-circle" className="mt-0.5 shrink-0" /><div><b className="block text-sm">We couldn’t prepare these details</b><p className="mt-1 text-xs">{error}</p><p className="mt-1 text-xs">Try again or continue entering your details manually.</p></div></div>}
      {warnings.map((warning, index) => <p key={index} className="mt-3 text-sm text-warn" role="status">{warning}</p>)}
      {sources && <div className="mt-5 border-t border-sage/30 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink">Review new, changed, and conflicting fields</p><button type="button" className="btn btn-dark btn-sm" disabled={!selectedKeys.length || unresolvedConflicts} onClick={applySelected}>Apply selected fields</button></div>
        <p className="mt-1 text-xs text-muted">Edit any suggested value before applying. New fields are selected by default. Changed fields are unchecked. Conflicting fields require choosing one source value before you can apply selections. Suggested credentials stay unverified.</p>
        {keys.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {keys.map((key) => {
            const options = candidates[key];
            const conflict = options.length > 1;
            const status = conflict ? 'Conflict' : statusOf(profile, key, options[0].value);
            const chosenIndex = selection[key]?.index;
            return <li key={key} className={'rounded-md border bg-white p-3 ' + (conflict ? 'border-warn/60' : 'border-line')}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-muted">{labelOf(key)}</span><span className={'badge ' + (conflict ? 'badge-warn' : status === 'New' ? 'badge-ok' : 'badge-muted')}>{status}</span></div>
              {!conflict && status === 'Changed' && <p className="mt-2 text-xs text-muted"><span className="font-semibold">Current:</span> {asText(currentValue(profile, key))}</p>}
              {conflict ? <fieldset className="mt-2 space-y-2"><legend className="text-xs text-muted">Choose which resource value to use</legend>{options.map((option, index) => <div key={index} className="rounded border border-line p-2"><label className="flex cursor-pointer items-start gap-2"><input type="radio" name={`profile-conflict-${key}`} className="mt-1 accent-[#142326]" checked={chosenIndex === index} onChange={() => setSelection((current) => ({ ...current, [key]: { index, enabled: true } }))} /><span className="min-w-0"><span className="block text-2xs text-muted">{option.sources.join(' · ')}</span></span></label>{chosenIndex === index && suggestionEditor(key, index)}</div>)}</fieldset>
                : <div className="mt-1"><label className="flex cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1 accent-[#142326]" checked={!!selection[key]?.enabled} onChange={(event) => setSelection((current) => ({ ...current, [key]: { index: 0, enabled: event.target.checked } }))} /><span className="min-w-0 flex-1"><span className="block text-2xs text-muted">{options[0].sources.join(' · ')}</span></span></label>{suggestionEditor(key, 0)}</div>}
            </li>;
          })}
        </ul> : <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-muted">The resources did not suggest any new or changed fields.</p>}
      </div>}
    </section>
  );
}
