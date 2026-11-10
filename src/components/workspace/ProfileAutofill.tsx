'use client';

import { useRef, useState } from 'react';

type Suggestions = Record<string, unknown>;
type SourceResult = { label: string; suggestions: Suggestions };
type Candidate = { value: unknown; sources: string[] };
type Selection = { index?: number; enabled: boolean };
type Props = { profile: Record<string, any>; onApply: (suggestions: Suggestions, selected: string[]) => void };

const LABELS: Record<string, string> = {
  displayName: 'Public name', title: 'Professional title', headline: 'Headline', intro: 'Short introduction', bio: 'Biography',
  experience: 'Years of experience', languages: 'Languages', areas: 'Service locations', specialties: 'Expertise',
  publicEmail: 'Business email', publicPhone: 'Business phone', whatsapp: 'WhatsApp', agencyName: 'Agency name',
  agencyWebsite: 'Agency website', credentials: 'Credentials',
};

function asText(value: unknown) {
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

export function ProfileAutofill({ profile, onApply }: Props) {
  const [website, setWebsite] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sources, setSources] = useState<SourceResult[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selection, setSelection] = useState<Record<string, Selection>>({});
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setWebsite(''); setFiles([]); setSources(null); setWarnings([]); setSelection({}); setEdits({}); setError('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const analyze = async () => {
    setBusy(true); setError(''); setSources(null); setWarnings([]); setSelection({}); setEdits({});
    try {
      const form = new FormData();
      if (website.trim()) form.set('website', website.trim());
      for (const file of files) form.append('files', file);
      form.set('profile', JSON.stringify(profile));
      const response = await fetch('/api/profile-autofill', { method: 'POST', body: form, credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not analyze the resource.');
      if (!Array.isArray(result.sources)) throw new Error(result.error || 'The AI response did not include any resource results. Please try again.');
      const analyzed = result.sources.filter((source: any) => source && typeof source.label === 'string' && source.suggestions && typeof source.suggestions === 'object' && !Array.isArray(source.suggestions)) as SourceResult[];
      if (!analyzed.length) throw new Error('No profile fields could be read from that resource. Try a clearer document or another source.');
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
      setError(cause instanceof Error ? cause.message : 'Could not analyze the resource.');
    } finally { setBusy(false); }
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
    const multiline = key === 'bio' || key === 'intro' || key === 'headline' || key === 'credentials';
    return multiline ? <textarea className="textarea mt-2 min-h-16 text-sm" rows={key === 'bio' ? 4 : 2} value={editorText(key, value)} onChange={(event) => updateEdit(key, index, event.target.value)} aria-label={`Edit suggested ${LABELS[key] || key}`} />
      : <input className="input mt-2 h-9 text-sm" type={typeof candidates[key][index].value === 'number' ? 'number' : 'text'} value={editorText(key, value)} onChange={(event) => updateEdit(key, index, event.target.value)} aria-label={`Edit suggested ${LABELS[key] || key}`} />;
  };
  const applySelected = () => {
    const chosen: Suggestions = {};
    for (const key of selectedKeys) chosen[key] = editedValue(key, selection[key].index!);
    onApply(chosen, selectedKeys);
    setSources(null); setWarnings([]); setSelection({}); setEdits({});
  };

  return (
    <section className="mb-8 rounded-lg border border-sage/30 bg-sage-soft/40 p-4 sm:p-5" aria-labelledby="profile-autofill-title">
      <div>
        <h3 id="profile-autofill-title" className="h4">Fill from your documents or website</h3>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">Add up to eight CVs, broker profiles, or credential documents together, or analyze one agency website. Claude suggests supported profile details for you to review before they enter your draft.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] sm:items-start">
        <label className="field"><span className="label">Website link</span><input className="input" type="url" placeholder="https://your-agency.com/team/you" value={website} disabled={Boolean(files.length)} onChange={(event) => setWebsite(event.target.value)} /></label>
        <label className="field"><span className="label">Documents</span><input ref={fileInput} className="input h-auto min-h-10 py-2" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" disabled={Boolean(website.trim())} onChange={(event) => setFiles(Array.from(event.target.files || []))} /><span className="hint">PDF, JPG, PNG or WebP · up to 20 MB each, 50 MB combined (8 files max).</span></label>
        <div className="flex gap-2 sm:mt-6">
          <button type="button" className="btn btn-dark" onClick={analyze} disabled={busy || (!website.trim() && !files.length)}>{busy ? 'Analyzing resources…' : 'Suggest profile details'}</button>
          <button type="button" className="btn btn-outline" onClick={reset} disabled={busy || (!website && !files.length && !sources && !error)}>Reset</button>
        </div>
      </div>
      {files.length > 0 && <p className="mt-2 text-xs text-muted">Selected: {files.map((file) => file.name).join(', ')}</p>}
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
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
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-muted">{LABELS[key] || key}</span><span className={'badge ' + (conflict ? 'badge-warn' : status === 'New' ? 'badge-ok' : 'badge-muted')}>{status}</span></div>
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
