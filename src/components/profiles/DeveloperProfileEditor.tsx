'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Field, type AiState } from '@/components/ui/Field';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { currentUser, saveUser } from '@/lib/store';
import { clone } from '@/lib/utils';
import { PROJECT_STATUSES, SOCIAL_PLATFORMS, type DeveloperProfile } from '@/lib/profileAutofill';
import { AiAutofill, type AiSummary } from './AiAutofill';

/* /profile for developer accounts: the public company profile shown at /developers/[slug], stored in
 * members.profile.developer. "Fill Profile with AI" sends documents / links / text to /api/profile-autofill,
 * which answers with the developer field set (see DEVELOPER_AI_FIELDS). AI values only fill empty fields;
 * a value that differs from what is already there, or that differs between sources, is offered as a
 * suggestion. Nothing is public until the developer saves. */

type Project = { name: string; location: string; status: string };
type Social = { platform: string; url: string };
type Candidates = Record<string, { value: unknown; sources: string[] }[]>;
type Suggestion = { value: any; sources: string[] }[];

const TEXT_KEYS = ['displayName', 'tagline', 'description', 'location', 'established', 'registrationNumber', 'website', 'email', 'phone', 'whatsapp'] as const;
const NUMBER_KEYS = ['completedProjects', 'unitsDelivered'] as const;
const LIST_KEYS = ['projectTypes', 'areas'] as const;

const blank = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? '').toLowerCase() === JSON.stringify(b ?? '').toLowerCase();
const show = (v: any) => (Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? x.name || x.url : x)).join(', ') : String(v));
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function initial(user: any): DeveloperProfile {
  const d = clone(user?.developer || {});
  return { public: true, ...d, displayName: d.displayName || user?.name || '' };
}

function TagInput({ id, values, onChange, placeholder }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v].slice(0, 20));
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1));
  };
  return (
    <div>
      {!!values.length && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v} className="chip">
              {v}
              <button type="button" className="ml-1 text-muted hover:text-ink" aria-label={'Remove ' + v} onClick={() => onChange(values.filter((x) => x !== v))}>
                <Icon name="x" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input id={id} className="input" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} />
    </div>
  );
}

export function DeveloperProfileEditor() {
  useStoreVersion();
  const user = currentUser();
  const { toast } = useFeedback();
  const [saved, setSaved] = useState<DeveloperProfile>(() => initial(user));
  const [d, setD] = useState<DeveloperProfile>(() => initial(user));
  const [ai, setAi] = useState<Record<string, AiState>>({});
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [snapshot, setSnapshot] = useState<DeveloperProfile | null>(null);
  const [error, setError] = useState('');
  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(saved), [d, saved]);
  const slug = d.slug || slugify(user?.name || '') || 'developer-' + user?.id;

  const set = <K extends keyof DeveloperProfile>(key: K, value: DeveloperProfile[K]) => {
    setD((cur) => ({ ...cur, [key]: value }));
    setAi((cur) => (cur[key as string] === 'filled' ? { ...cur, [key as string]: 'edited' } : cur));
  };
  const text = (key: (typeof TEXT_KEYS)[number]) => ({ id: 'dev-' + key, className: 'input', value: (d[key] as string) || '', onChange: (e: any) => set(key, e.target.value) });

  /* ---------- AI ---------- */
  const applyAutofill = (_s: Record<string, any>, selected: string[], candidates: Candidates): AiSummary => {
    const next: DeveloperProfile = clone(d);
    const states: Record<string, AiState> = { ...ai };
    const pending: Record<string, Suggestion> = { ...suggestions };
    let filled = 0, kept = 0;
    for (const key of selected) {
      const options = (candidates[key] || []) as Suggestion;
      if (!options.length) continue;
      const current = (next as any)[key];
      if ((LIST_KEYS as readonly string[]).includes(key) || key === 'projects' || key === 'socials') {
        // Lists: add every item any source found that is not there yet.
        const items: any[] = Array.isArray(current) ? current.slice() : [];
        const id = (x: any) => (typeof x === 'string' ? x : key === 'socials' ? x.url : x.name).toLowerCase();
        let added = 0;
        for (const option of options) for (const item of (option.value as any[]) || []) {
          if (items.some((x) => id(x) === id(item))) continue;
          items.push(item);
          added++;
        }
        if (added) {
          (next as any)[key] = items.slice(0, 20);
          states[key] = 'filled';
          filled += added;
        } else kept++;
        continue;
      }
      const differing = options.filter((o) => !same(o.value, current));
      if (blank(current) && options.length === 1) {
        (next as any)[key] = options[0].value;
        states[key] = 'filled';
        filled++;
      } else if (differing.length) {
        // Already filled, or the sources disagree: let the developer choose.
        pending[key] = differing;
        states[key] = 'suggestion';
      } else kept++;
    }
    setSnapshot((s) => s || clone(d));
    setD(next);
    setAi(states);
    setSuggestions(pending);
    const review = Object.keys(pending).length;
    const missing = ['displayName', 'description', 'location', 'website'].filter((k) => blank((next as any)[k]) && !pending[k]).length;
    toast('Autofill applied: ' + filled + ' item' + (filled === 1 ? '' : 's') + ' added' + (review ? ', ' + review + ' to review' : '') + '. Nothing is public until you save.');
    return { filled, missing, kept, review };
  };
  const applySuggestion = (key: string, value: any) => {
    setD((cur) => ({ ...cur, [key]: value }));
    setAi((cur) => ({ ...cur, [key]: 'filled' }));
    setSuggestions(({ [key]: _, ...rest }) => rest);
  };
  const dismissSuggestion = (key: string) => {
    setSuggestions(({ [key]: _, ...rest }) => rest);
    setAi(({ [key]: _, ...rest }) => rest);
  };
  const undoAI = () => {
    if (snapshot) setD(snapshot);
    setSnapshot(null);
    setAi({});
    setSuggestions({});
    toast('AI changes undone.');
  };

  /* ---------- save ---------- */
  const save = () => {
    if (!String(d.displayName || '').trim()) {
      setError('Enter your company name.');
      document.getElementById('dev-displayName')?.focus();
      return;
    }
    if (d.website && !/^https?:\/\/\S+\.\S+/.test(d.website)) {
      setError('Enter the website as a full address, e.g. https://example.com.');
      document.getElementById('dev-website')?.focus();
      return;
    }
    setError('');
    const clean: DeveloperProfile = { ...d, displayName: d.displayName!.trim(), updatedAt: new Date().toISOString() };
    for (const k of NUMBER_KEYS) if (clean[k] != null && !(Number(clean[k]) > 0)) delete clean[k];
    clean.projects = (clean.projects || []).filter((p) => p.name.trim());
    clean.socials = (clean.socials || []).filter((s) => /^https?:\/\//.test(s.url));
    const u = currentUser();
    u.developer = { ...(u.developer || {}), ...clean };
    saveUser(u);
    setSaved(clean);
    setD(clean);
    setSnapshot(null);
    setAi({});
    setSuggestions({});
    toast('Developer profile saved.');
  };

  const suggestionRow = (k: string) =>
    suggestions[k] ? (
      <div className="mt-2 rounded-lg border border-[#c6c5f5] bg-[#f5f6ff] p-2.5 text-[13px]">
        <p className="flex items-center gap-1.5 font-semibold text-[#4338a8]">
          <Icon name="stars" /> AI found {suggestions[k].length === 1 ? 'a different value' : suggestions[k].length + ' different values'}
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {suggestions[k].map((o, i) => (
            <li key={i} className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 flex-1">
                <span className="line-clamp-3 text-ink">{show(o.value)}</span>
                <span className="block text-xs text-muted">{o.sources.join(' · ')}</span>
              </span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => applySuggestion(k, o.value)}>Use this</button>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-1.5 text-xs text-muted underline" onClick={() => dismissSuggestion(k)}>Keep mine</button>
      </div>
    ) : null;

  const projects = d.projects || [];
  const socials = d.socials || [];
  const setProject = (i: number, patch: Partial<Project>) => set('projects', projects.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setSocial = (i: number, patch: Partial<Social>) => set('socials', socials.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your developer presence</p>
          <h1 className="h2 mt-1 text-[24px] lg:text-[28px]">Developer Profile</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            The company profile buyers and brokers see on your public developer page, next to your published projects.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-outline" href={'/developers/' + encodeURIComponent(slug)} target="_blank" rel="noopener">
            <Icon name="box-arrow-up-right" /> View public page
          </Link>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty}>
            <Icon name="floppy" /> Save profile
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{dirty ? 'Unsaved changes' : saved.updatedAt ? 'Saved ' + new Date(saved.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'All changes saved'}</p>
      {error && <p className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}

      <div className="mt-5">
        <AiAutofill
          id="developer-profile-ai"
          context="developer-profile"
          defaultOpen={typeof window !== 'undefined' && location.hash === '#autofill'}
          current={d}
          onApply={applyAutofill}
          onUndo={snapshot ? undoAI : undefined}
          onReview={() => document.getElementById('dev-company')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          onManual={() => document.getElementById('dev-displayName')?.focus()}
        />
      </div>

      <div className="mt-6 space-y-6">
        <section id="dev-company" className="card p-5 sm:p-7">
          <h2 className="h3">Company</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field id="dev-displayName" label="Company name" aiState={ai.displayName}>
              <input {...text('displayName')} />
              {suggestionRow('displayName')}
            </Field>
            <Field id="dev-tagline" label="Tagline" optional="optional" aiState={ai.tagline}>
              <input {...text('tagline')} maxLength={120} />
              {suggestionRow('tagline')}
            </Field>
            <Field id="dev-description" label="About the company" className="sm:col-span-2" aiState={ai.description} hint={(d.description || '').length + ' / 2000'}>
              <textarea {...text('description')} rows={6} maxLength={2000} />
              {suggestionRow('description')}
            </Field>
            <Field id="dev-location" label="Headquarters" aiState={ai.location}>
              <input {...text('location')} placeholder="Dubai, UAE" />
              {suggestionRow('location')}
            </Field>
            <Field id="dev-established" label="Year established" optional="optional" aiState={ai.established}>
              <input {...text('established')} inputMode="numeric" maxLength={4} />
              {suggestionRow('established')}
            </Field>
            <Field id="dev-registrationNumber" label="Developer registration number" optional="optional" aiState={ai.registrationNumber} hint="RERA / DLD developer number or trade licence. Shown on your listings.">
              <input {...text('registrationNumber')} />
              {suggestionRow('registrationNumber')}
            </Field>
          </div>
        </section>

        <section className="card p-5 sm:p-7">
          <h2 className="h3">Public contact</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field id="dev-website" label="Website" optional="optional" aiState={ai.website}>
              <input {...text('website')} type="url" placeholder="https://" />
              {suggestionRow('website')}
            </Field>
            <Field id="dev-email" label="Sales email" optional="optional" aiState={ai.email}>
              <input {...text('email')} type="email" />
              {suggestionRow('email')}
            </Field>
            <Field id="dev-phone" label="Phone" optional="optional" aiState={ai.phone}>
              <input {...text('phone')} type="tel" />
              {suggestionRow('phone')}
            </Field>
            <Field id="dev-whatsapp" label="WhatsApp" optional="optional" aiState={ai.whatsapp}>
              <input {...text('whatsapp')} type="tel" />
              {suggestionRow('whatsapp')}
            </Field>
          </div>
        </section>

        <section className="card p-5 sm:p-7">
          <h2 className="h3">Portfolio</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field id="dev-projectTypes" label="Project types" optional="optional" aiState={ai.projectTypes}>
              <TagInput id="dev-projectTypes" values={d.projectTypes || []} onChange={(v) => set('projectTypes', v)} placeholder="e.g. Apartments — press Enter" />
            </Field>
            <Field id="dev-areas" label="Communities" optional="optional" aiState={ai.areas}>
              <TagInput id="dev-areas" values={d.areas || []} onChange={(v) => set('areas', v)} placeholder="e.g. Dubai Hills Estate — press Enter" />
            </Field>
            {NUMBER_KEYS.map((k) => (
              <Field key={k} id={'dev-' + k} label={k === 'completedProjects' ? 'Projects delivered' : 'Units delivered'} optional="optional" aiState={ai[k]}>
                <input id={'dev-' + k} className="input" type="number" min={0} value={d[k] ?? ''} onChange={(e) => set(k, e.target.value === '' ? undefined : Number(e.target.value))} />
                {suggestionRow(k)}
              </Field>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2">
            <h3 className="h4">Key projects</h3>
            {ai.projects === 'filled' && <span className="text-xs font-semibold text-[#4338a8]"><Icon name="stars" /> AI-filled</span>}
          </div>
          <ul className="mt-3 space-y-2">
            {projects.map((p, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_180px_auto]">
                <input className="input" aria-label={'Project ' + (i + 1) + ' name'} placeholder="Project name" value={p.name} onChange={(e) => setProject(i, { name: e.target.value })} />
                <input className="input" aria-label={'Project ' + (i + 1) + ' community'} placeholder="Community" value={p.location} onChange={(e) => setProject(i, { location: e.target.value })} />
                <select className="input" aria-label={'Project ' + (i + 1) + ' status'} value={p.status} onChange={(e) => setProject(i, { status: e.target.value })}>
                  <option value="">Status</option>
                  {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button type="button" className="btn btn-ghost btn-danger" aria-label={'Remove project ' + (i + 1)} onClick={() => set('projects', projects.filter((_, j) => j !== i))}>
                  <Icon name="trash3" />
                </button>
              </li>
            ))}
          </ul>
          {projects.length < 20 && (
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => set('projects', [...projects, { name: '', location: '', status: '' }])}>
              <Icon name="plus-lg" /> Add project
            </button>
          )}
        </section>

        <section className="card p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <h2 className="h3">Social profiles</h2>
            {ai.socials === 'filled' && <span className="text-xs font-semibold text-[#4338a8]"><Icon name="stars" /> AI-filled</span>}
          </div>
          <ul className="mt-4 space-y-2">
            {socials.map((s, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                <select className="input" aria-label={'Link ' + (i + 1) + ' platform'} value={s.platform} onChange={(e) => setSocial(i, { platform: e.target.value })}>
                  {[...new Set([...SOCIAL_PLATFORMS, s.platform || 'Other'])].map((p) => <option key={p}>{p}</option>)}
                </select>
                <input className="input" type="url" aria-label={'Link ' + (i + 1) + ' URL'} placeholder="https://" value={s.url} onChange={(e) => setSocial(i, { url: e.target.value })} />
                <button type="button" className="btn btn-ghost btn-danger" aria-label={'Remove link ' + (i + 1)} onClick={() => set('socials', socials.filter((_, j) => j !== i))}>
                  <Icon name="trash3" />
                </button>
              </li>
            ))}
          </ul>
          {socials.length < 10 && (
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => set('socials', [...socials, { platform: 'Instagram', url: '' }])}>
              <Icon name="plus-lg" /> Add link
            </button>
          )}
        </section>

        <section className="card p-5 sm:p-7">
          <h2 className="h3">Visibility</h2>
          <label className="mt-4 flex items-start gap-3 text-[13px]">
            <input type="checkbox" className="mt-0.5" checked={d.public !== false} onChange={(e) => set('public', e.target.checked)} />
            <span>
              <span className="block font-semibold text-ink">Show my developer profile publicly</span>
              <span className="text-muted">Listed on the Developers directory at /developers/{slug}.</span>
            </span>
          </label>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-line bg-white/95 py-3">
        {dirty && (
          <button type="button" className="btn btn-ghost" onClick={() => { setD(saved); setAi({}); setSuggestions({}); setSnapshot(null); }}>
            Discard changes
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty}>
          <Icon name="floppy" /> Save profile
        </button>
      </div>
    </div>
  );
}
