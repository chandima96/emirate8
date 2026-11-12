'use client';

import { createContext, useContext, useEffect, useRef, type ComponentProps } from 'react';
import { Icon } from './Icon';
import { Field } from './Field';

export type AiFieldState = 'filled' | 'edited' | 'missing' | 'suggestion';
export type AiSuggestion = { value: any; sources?: string[]; options?: { value: any; sources: string[] }[] };
export type AiReviewValue = { states: Record<string, AiFieldState>; suggestions: Record<string, AiSuggestion>; use: (id: string) => void; keep: (id: string) => void; select: (id: string, value: any) => void };
export const AiReviewContext = createContext<AiReviewValue>({ states: {}, suggestions: {}, use: () => {}, keep: () => {}, select: () => {} });

export function AiField(props: ComponentProps<typeof Field>) {
  const contextValue = useContext(AiReviewContext);
  // Keep fields resilient to a stale provider value during Next.js Fast Refresh.
  const review: AiReviewValue = contextValue && typeof contextValue === 'object' && 'states' in contextValue
    ? contextValue
    : { states: contextValue as unknown as Record<string, AiFieldState>, suggestions: {}, use: () => {}, keep: () => {}, select: () => {} };
  const id = props.id || '';
  const suggestion = review.suggestions?.[id];
  const state = suggestion ? 'suggestion' : review.states[id];
  const valueText = (value: any) => Array.isArray(value) ? value.map((item) => typeof item === 'object' && item ? [item.label, item.value].filter(Boolean).join(': ') : item).join(', ') : value && typeof value === 'object' ? Object.entries(value).map(([key, item]) => `${key}: ${item}`).join(', ') : String(value ?? '');
  const activeValue = suggestion?.value;
  return <Field {...props} aiState={state}>
    {props.children}
    {suggestion && <div className="mt-2 rounded-md border border-[#c6c5f5] bg-[#f5f6ff] p-3 text-xs text-[#344078]">
      <p><Icon name="stars" className="mr-1 text-[#5142c6]" />AI suggestion: <span className="font-semibold">{valueText(activeValue)}</span></p>
      {suggestion.options && suggestion.options.length > 1 && <select className="select mt-2" aria-label="Choose an AI suggestion" value={suggestion.options.findIndex((option) => JSON.stringify(option.value) === JSON.stringify(activeValue))} onChange={(event) => review.select(id, suggestion.options![Number(event.target.value)].value)}>{suggestion.options.map((option, index) => <option key={index} value={index}>{valueText(option.value)} — {option.sources.join(', ')}</option>)}</select>}
      {suggestion.sources?.length ? <p className="mt-1 text-muted">From {suggestion.sources.join(', ')}</p> : null}
      <div className="mt-2 flex gap-2"><button type="button" className="btn btn-dark btn-sm" onClick={() => review.use(id)}>Use suggestion</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => review.keep(id)}>Keep mine</button></div>
    </div>}
  </Field>;
}

export function AiBanner({ kind, open, onStart, onManual, controls }: {
  kind: 'listing' | 'profile'; open: boolean; onStart: () => void; onManual: () => void; controls: string;
}) {
  const listing = kind === 'listing';
  const orbHighlightRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const highlight = orbHighlightRef.current;
    if (!highlight || listing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = highlight.animate(
      [
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 0.88 },
        { transform: 'translate3d(34px, 13px, 0) scale(0.9)', opacity: 0.62 },
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 0.88 },
      ],
      { duration: 14000, iterations: Infinity, easing: 'ease-in-out' },
    );
    return () => animation.cancel();
  }, [listing]);
  return (
    <section className="relative isolate mt-[20px] grid min-h-[290px] overflow-hidden rounded-md border border-[#b8dfff] bg-[radial-gradient(ellipse_at_82%_30%,rgba(94,185,255,0.27),transparent_34%),radial-gradient(ellipse_at_98%_88%,rgba(187,137,255,0.24),transparent_38%),radial-gradient(ellipse_at_4%_100%,rgba(109,224,232,0.13),transparent_42%),linear-gradient(118deg,#ffffff_0%,#f4f9ff_48%,#f7f2ff_100%)] shadow-[0_10px_32px_rgba(89,111,188,0.16)] sm:grid-cols-[minmax(0,1fr)_420px]" aria-label="AI assistant">
      <div className="relative z-10 self-center p-5 sm:px-8 sm:py-7">
        <div className="mb-3 flex flex-wrap gap-2">
          {listing && <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f3ff] px-2.5 py-1 text-xs font-semibold text-[#3846ae]"><Icon name="lightning-charge-fill" />New feature</span>}
          <span className="inline-flex items-center gap-1 rounded border border-[#d7a9ff] bg-[#fffaff]/80 px-2.5 py-1 text-xs font-semibold text-[#5142c6]"><Icon name="stars" className="text-[#6f7bff]" />AI-powered</span>
        </div>
        <h2 className="max-w-2xl text-[24px] font-semibold leading-tight tracking-tight text-ink sm:text-[26px]">{listing ? 'Turn property documents into a listing' : 'Build your profile faster with AI'}</h2>
        <p className="mt-2 max-w-[560px] text-sm leading-6 text-[#66727a]">{listing
          ? 'Upload property documents and let AI prepare listing details. Review, adjust, and complete your listing before publishing.'
          : 'Add your information or upload existing documents, and let AI prepare your profile. Review and edit every detail before saving.'}</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button className="btn btn-lg btn-dark" type="button" aria-expanded={open} aria-controls={open ? controls : undefined} onClick={onStart}><Icon name="stars" />{listing ? 'Prepare listing with AI' : 'Fill my profile with AI'}</button>
          <button className="btn btn-lg btn-outline" type="button" onClick={onManual}>{listing ? 'Enter details manually' : 'Continue manually'}<Icon name="arrow-right" /></button>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Icon name="shield-check" className="mt-0.5 shrink-0 text-[#6256d9]" />{listing ? 'Review every suggestion before saving or publishing.' : 'Nothing is published until you review and save your changes.'}</p>
      </div>
      <div aria-hidden="true" className="relative hidden min-h-[290px] items-center justify-center overflow-hidden sm:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_55%_50%,rgba(157,196,255,0.32),transparent_62%),linear-gradient(135deg,rgba(226,247,255,0.32),rgba(228,224,255,0.68))]" />
        <div className="absolute left-1/2 top-1/2 h-32 w-[300px] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] rounded-[50%] border border-[#9acbff]/45 motion-safe:animate-[spin_36s_linear_infinite]" />
        <div className="absolute left-1/2 top-1/2 h-24 w-[290px] -translate-x-1/2 -translate-y-1/2 rotate-[10deg] rounded-[50%] border border-[#c5a5ff]/35 motion-safe:animate-[spin_48s_linear_infinite_reverse]" />
        <div className="absolute h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(89,174,255,0.46),rgba(139,111,255,0.28)_48%,transparent_72%)] blur-xl motion-safe:animate-pulse" />
        <div className="relative h-[172px] w-[172px] overflow-hidden rounded-full border border-white/70 bg-[radial-gradient(ellipse_at_31%_18%,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.3)_11%,transparent_25%),radial-gradient(ellipse_at_21%_73%,rgba(58,222,239,0.96)_0%,transparent_40%),radial-gradient(ellipse_at_79%_29%,rgba(184,112,255,0.95)_0%,transparent_46%),radial-gradient(ellipse_at_57%_58%,rgba(91,119,222,0.92)_0%,transparent_64%),linear-gradient(145deg,#8ebcff_0%,#5865c9_55%,#62c9e2_100%)] shadow-[0_22px_46px_rgba(54,87,190,0.38),inset_-12px_-16px_24px_rgba(35,47,126,0.4),inset_8px_8px_20px_rgba(255,255,255,0.5)]">
          <span ref={orbHighlightRef} className="absolute left-[17%] top-[8%] h-[46px] w-[82px] -rotate-[18deg] rounded-[50%] bg-gradient-to-br from-white/95 via-white/70 to-white/5 blur-[2px] shadow-[0_2px_12px_rgba(255,255,255,0.5)]" />
          <span className="absolute left-[24%] top-[10%] h-4 w-10 -rotate-[18deg] rounded-full bg-white/75 blur-md" />
          <span className="absolute -left-[8%] top-[56%] h-20 w-20 rounded-full bg-cyan-200/25 blur-2xl" />
          <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 via-transparent to-[#17256c]/25" />
          <span className="absolute inset-[3px] rounded-full border border-white/25 shadow-[inset_0_2px_5px_rgba(255,255,255,0.55)]" />
        </div>
        <Icon name="stars" className="absolute left-[20%] top-[25%] text-xs text-[#8daaff]" />
        <Icon name="stars" className="absolute right-[15%] bottom-[22%] text-sm text-[#b58cff]" />
        {listing && <div className="absolute right-8 top-8 grid h-16 w-12 gap-1 rounded-md border border-[#d9d8ff] bg-white p-2 shadow-lg"><i className="h-1 rounded bg-[#c7c5ff]" /><i className="h-1 rounded bg-[#e1e5eb]" /><i className="h-1 rounded bg-[#e1e5eb]" /><i className="h-1 rounded bg-[#e4e2ff]" /></div>}
      </div>
    </section>
  );
}

export function AiDocumentInput({ files, onChange, disabled = false, onError }: {
  files: File[]; onChange: (files: File[]) => void; disabled?: boolean; onError: (message: string) => void;
}) {
  const accept = (incoming: File[]) => {
    if (disabled) return;
    const next = [...files];
    for (const file of incoming) if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
    if (next.length > 8) return onError('Choose up to eight documents.');
    if (next.some((file) => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))) return onError('Upload PDF, JPG, PNG or WebP documents only.');
    if (next.some((file) => file.size > 20 * 1024 * 1024 || !file.size)) return onError('Each document must contain data and be 20 MB or smaller.');
    if (next.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) return onError('The combined document size must be 50 MB or smaller.');
    onError(''); onChange(next);
  };
  return <div>
    <label className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[#c6c5f5] bg-[#f4f6ff] px-4 py-6 text-center transition hover:border-[#8274e8] hover:bg-[#eff1ff] focus-within:border-[#6256d9] ${disabled ? 'cursor-not-allowed opacity-50' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); accept(Array.from(event.dataTransfer.files)); }}>
      <Icon name="file-earmark-arrow-up" className="mb-2 text-2xl text-[#5142c6]" /><b className="text-sm text-ink">Drop documents or browse</b>
      <small className="mt-1 text-xs text-muted">PDF, JPG, PNG or WebP · up to 8 files · 20 MB each · 50 MB total</small>
      <input type="file" className="sr-only" multiple accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} aria-label="Choose documents" onChange={(event) => { accept(Array.from(event.target.files || [])); event.target.value = ''; }} />
    </label>
    {files.length > 0 && <ul className="mt-3 flex flex-col gap-1.5" aria-label="Selected documents">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex min-w-0 items-center gap-2 rounded border border-line bg-white px-3 py-2 text-xs">
      <Icon name="file-earmark-text" className="text-[#5142c6]" /><b className="min-w-0 flex-1 truncate font-normal">{file.name}</b><span className="shrink-0 text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))}><Icon name="x-lg" /></button>
    </li>)}</ul>}
  </div>;
}

export function AiProgress({ title, detail, onCancel, kind = 'profile' }: { title: string; detail: string; onCancel: () => void; kind?: 'profile' | 'listing' }) {
  if (kind === 'listing') return <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-[#c6c5f5] bg-[#f4f6ff] px-4 py-3">
    <span className="grid h-8 w-8 shrink-0 animate-pulse place-items-center rounded-full bg-gradient-to-br from-[#38c9e8] to-[#6154d9] text-white"><Icon name="stars" /></span>
    <div className="min-w-0 flex-1" role="status" aria-live="polite"><b className="block text-sm text-[#252c69]">{title}</b><small className="text-xs text-muted">{detail}</small></div>
    <button className="btn btn-outline btn-sm" type="button" onClick={onCancel}>Cancel</button>
  </div>;
  return <div className="relative isolate mt-5 flex min-h-[60px] flex-wrap items-center gap-3 overflow-hidden rounded-md border border-[#c6c5f5] bg-gradient-to-r from-[#f7fbff] via-[#f4f3ff] to-[#fbf5ff] px-4 py-2.5" role="status" aria-live="polite">
    <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
      <div aria-hidden="true" className="relative grid h-10 w-10 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full border border-[#aaa4ff]/60 motion-safe:animate-[spin_5s_linear_infinite]" />
        <span className="absolute inset-1 rounded-full border border-dashed border-[#62c8ec]/70 motion-safe:animate-[spin_7s_linear_infinite_reverse]" />
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#46d2e8] via-[#7a82f7] to-[#bd72e9] text-white shadow-[0_5px_18px_rgba(104,105,221,0.35)] motion-safe:animate-pulse"><Icon name="stars" /></span>
      </div>
      <div className="min-w-0 flex-1">
        <b className="block text-sm leading-5 text-[#252c69]">{title}</b>
        <small className="block text-xs leading-4 text-muted">{detail}</small>
        <div aria-hidden="true" className="mt-1 h-1 max-w-sm overflow-hidden rounded-full bg-[#dddafa]"><span className="block h-full w-2/5 rounded-full bg-gradient-to-r from-[#36cce4] via-[#6d75ec] to-[#bd76ed] motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]" /></div>
      </div>
    </div>
    <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 -z-0 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(116,168,255,0.24),rgba(194,128,255,0.16)_48%,transparent_72%)] blur-md" />
    <button className="relative z-10 btn btn-outline btn-sm" type="button" onClick={onCancel}>Cancel</button>
  </div>;
}

export function AiNotice({ filled, edited, missing = 0, review = 0, onUndo }: { filled: number; edited: number; missing?: number; review?: number; onUndo: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, []);
  return <div ref={ref} className="ai-notice relative isolate mb-6 flex flex-wrap items-center gap-4 overflow-hidden rounded-xl border-2 border-[#c9c4ff] bg-[radial-gradient(ellipse_at_100%_0%,rgba(185,169,255,0.28),transparent_42%),radial-gradient(ellipse_at_0%_100%,rgba(70,210,232,0.14),transparent_40%),linear-gradient(115deg,#ffffff_0%,#f5f6ff_58%,#f3eeff_100%)] p-5 sm:gap-5 sm:p-6" role="status">
    <span aria-hidden="true" className="ai-notice-icon relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#38cde4] via-[#7177ec] to-[#b26de2] text-white shadow-[0_8px_22px_rgba(104,105,221,0.38)]"><Icon name="stars" className="text-2xl" /></span>
    <div className="relative z-10 min-w-0 flex-1">
      <b className="block text-lg font-semibold leading-snug tracking-tight text-[#252c69] sm:text-xl">AI has prepared these details.</b>
      <p className="mt-0.5 text-sm text-[#4a5288] sm:text-[15px]">Please review them before continuing.</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8d5fb] bg-white/90 px-3 py-1.5 font-semibold text-[#5142a7]"><Icon name="stars" />{filled} AI-filled</span><span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/90 px-3 py-1.5 font-semibold text-muted"><Icon name="pencil" />{edited} edited</span>{missing + review > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f0d7a8] bg-[#fffaf0] px-3 py-1.5 font-semibold text-warn"><Icon name="exclamation-circle" />{missing + review} need your input</span>}</div>
    </div>
    <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 -z-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(141,132,255,0.24),transparent_68%)] blur-lg" />
    <button type="button" className="relative z-10 btn btn-ghost btn-sm" onClick={onUndo}><Icon name="arrow-counterclockwise" />Undo AI changes</button>
  </div>;
}
