'use client';

import { createContext, useContext, type ComponentProps } from 'react';
import { Icon } from './Icon';
import { Field } from './Field';

export type AiFieldState = 'filled' | 'edited' | 'missing';
export const AiReviewContext = createContext<Record<string, AiFieldState>>({});

export function AiField(props: ComponentProps<typeof Field>) {
  const states = useContext(AiReviewContext);
  return <Field {...props} aiState={states[props.id || '']} />;
}

export function AiBanner({ kind, open, onStart, onManual, controls }: {
  kind: 'listing' | 'profile'; open: boolean; onStart: () => void; onManual: () => void; controls: string;
}) {
  const listing = kind === 'listing';
  return (
    <section className="relative isolate grid overflow-hidden rounded-lg border border-[#b8dfff] bg-gradient-to-br from-[#f4f9ff] via-white to-[#f2edff] shadow-[0_10px_28px_rgba(89,111,188,0.12)] sm:grid-cols-[minmax(0,1fr)_220px]" aria-label="AI assistant">
      <div className="relative z-10 p-5 sm:p-7">
        <div className="mb-3 flex flex-wrap gap-2">
          {listing && <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f3ff] px-2.5 py-1 text-xs font-semibold text-[#3846ae]"><Icon name="lightning-charge-fill" />New feature</span>}
          <span className="inline-flex items-center gap-1 rounded-full border border-[#c6b7ff] bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#5142c6]"><Icon name="stars" />AI-powered</span>
        </div>
        <h2 className="max-w-2xl text-xl font-semibold tracking-tight text-ink sm:text-2xl">{listing ? 'Turn property documents into a listing' : 'Build your profile faster with AI'}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{listing
          ? 'Upload property documents and let AI prepare listing details. Review, adjust, and complete your listing before publishing.'
          : 'Add your information or upload existing documents, and let AI prepare your profile. Review and edit every detail before saving.'}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn btn-lg btn-dark" type="button" aria-expanded={open} aria-controls={open ? controls : undefined} onClick={onStart}><Icon name="stars" />{listing ? 'Prepare listing with AI' : 'Fill my profile with AI'}</button>
          <button className="btn btn-lg btn-outline" type="button" onClick={onManual}>{listing ? 'Enter details manually' : 'Continue manually'}<Icon name="arrow-right" /></button>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Icon name="shield-check" className="mt-0.5 shrink-0 text-[#6256d9]" />{listing ? 'Review every suggestion before saving or publishing.' : 'Nothing is published until you review and save your changes.'}</p>
      </div>
      <div aria-hidden="true" className="relative hidden min-h-48 items-center justify-center overflow-hidden sm:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e8faff]/70 via-[#e7eaff]/80 to-[#f5e5ff]/80" />
        <div className="absolute h-40 w-40 rounded-full bg-gradient-to-br from-[#44d9ed] via-[#7868f3] to-[#d78af5] opacity-80 blur-2xl" />
        <div className="relative grid h-28 w-28 place-items-center rounded-full border border-white/80 bg-[radial-gradient(ellipse_at_32%_24%,#ffffff_0%,#d8cfff_18%,#a58af4_40%,#36c9e4_72%,#8c99ef_100%)] shadow-[0_14px_34px_rgba(73,89,185,0.38)] after:absolute after:inset-[7px] after:rounded-full after:border after:border-white/30">
          <Icon name="stars" className="relative z-10 text-3xl text-white drop-shadow" />
        </div>
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

export function AiProgress({ title, detail, onCancel }: { title: string; detail: string; onCancel: () => void }) {
  return <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-[#c6c5f5] bg-[#f4f6ff] px-4 py-3">
    <span className="grid h-8 w-8 shrink-0 animate-pulse place-items-center rounded-full bg-gradient-to-br from-[#38c9e8] to-[#6154d9] text-white"><Icon name="stars" /></span>
    <div className="min-w-0 flex-1" role="status" aria-live="polite"><b className="block text-sm text-[#252c69]">{title}</b><small className="text-xs text-muted">{detail}</small></div>
    <button className="btn btn-outline btn-sm" type="button" onClick={onCancel}>Cancel</button>
  </div>;
}

export function AiNotice({ filled, edited, missing = 0, onUndo }: { filled: number; edited: number; missing?: number; onUndo: () => void }) {
  return <div className="mb-5 flex flex-wrap items-start gap-3 rounded-md border border-[#c6c5f5] border-l-4 border-l-[#6959dc] bg-[#f5f6ff] p-4" role="status">
    <Icon name="stars" className="mt-0.5 text-[#5142c6]" /><div className="min-w-0 flex-1"><b className="block text-sm text-[#252c69]">AI has prepared these details. Please review them before continuing.</b>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span><Icon name="stars" /> {filled} AI-filled</span><span><Icon name="pencil" /> {edited} edited</span>{missing > 0 && <span className="text-warn"><Icon name="exclamation-circle" /> {missing} need your input</span>}</div>
    </div>
    <button type="button" className="btn btn-ghost btn-sm" onClick={onUndo}><Icon name="arrow-counterclockwise" />Undo AI changes</button>
  </div>;
}
