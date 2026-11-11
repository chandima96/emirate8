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
    <section className="relative isolate grid min-h-[290px] overflow-hidden rounded-md border border-[#b8dfff] bg-gradient-to-br from-[#f8fbff] via-[#f1f7ff] to-[#f2edff] shadow-[0_10px_28px_rgba(89,111,188,0.12)] sm:grid-cols-[minmax(0,1fr)_420px]" aria-label="AI assistant">
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
        <div className="absolute left-1/2 top-1/2 h-32 w-[300px] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] rounded-[50%] border border-[#9acbff]/35" />
        <div className="absolute left-1/2 top-1/2 h-24 w-[290px] -translate-x-1/2 -translate-y-1/2 rotate-[10deg] rounded-[50%] border border-[#c5a5ff]/25" />
        <div className="absolute h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(89,174,255,0.40),rgba(139,111,255,0.22)_48%,transparent_72%)] blur-xl" />
        <div className="relative h-[172px] w-[172px] rounded-full border border-white/60 bg-[radial-gradient(ellipse_at_34%_22%,#ffffff_0%,rgba(255,255,255,0.82)_9%,transparent_25%),radial-gradient(ellipse_at_25%_75%,#22d3ee_0%,transparent_46%),radial-gradient(ellipse_at_80%_30%,#c084fc_0%,transparent_52%),linear-gradient(135deg,#93c5fd,#6366f1_58%,#c084fc)] shadow-[0_18px_38px_rgba(62,94,202,0.34),inset_-8px_-12px_24px_rgba(49,54,160,0.22),inset_8px_8px_22px_rgba(255,255,255,0.56)]">
          <span className="absolute left-[18%] top-[10%] h-10 w-[68px] -rotate-[18deg] rounded-[50%] bg-white/70 blur-md" />
          <Icon name="stars" className="absolute right-[20%] top-[22%] text-sm text-white/80 drop-shadow" />
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
