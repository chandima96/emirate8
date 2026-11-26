'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AiCreditsBadge, AiCreditsCard, readAiResponse, useAiCredits } from '@/components/ai/AiCredits';
import './profiles.css';

/* "Fill Profile with AI" / "Create Listing with AI" — React port of UI_Changes/emirate8-page-updates/js/ai-autofill.js.
 * New-feature banner first; the CTA reveals a chat-style resource composer (documents, links, pasted text — no
 * conversation), then processing steps and a result summary. Unlike the demo, resources are really processed by
 * /api/profile-autofill or /api/listing-autofill. The page adapter (`onApply`) writes values into ITS form and
 * returns what it did, so the summary reports real counts. Styles: ./profiles.css (ai.css + ai-autofill.css). */

export type AiContext = 'listing' | 'broker-profile' | 'agency-profile' | 'developer-profile';
export type AiSummary = { filled: number; missing: number; kept?: number; errors?: number; review?: number };
/** `other`: found on the page outside the listing itself (similar listings, articles, area photos). */
export type AiFoundPhotos = { files: File[]; links: { url: string; source: string; other?: boolean }[] };
type Candidates = Record<string, { value: unknown; sources: string[] }[]>;
type Props = {
  context: AiContext;
  /** Current form values, sent only so the model can avoid duplicate suggestions. */
  current: Record<string, any>;
  /** `photos`: image files the user attached and photos found on the linked pages, for the page to offer. */
  onApply: (suggestions: Record<string, any>, selected: string[], candidates: Candidates, photos: AiFoundPhotos) => AiSummary | Promise<AiSummary>;
  onReview?: () => void;
  onUndo?: () => void;
  onManual?: () => void;
  /** Hide the success summary card (the page shows its own AI notice instead). Errors still show. */
  hideSummary?: boolean;
  id?: string;
  /** Start with the resource panel open (e.g. arriving via #autofill). */
  defaultOpen?: boolean;
};

const COPY = {
  listing: {
    heading: 'Create Property Listings Faster with AI',
    desc: 'Upload property documents, paste listing information, or provide relevant links. Our AI-assisted workflow helps extract available details and automatically fill your property listing form.',
    cta: 'Create Listing with AI',
    panel: 'Create Listing with AI',
    support: 'Add your property information, documents, or links to automatically populate your listing form.',
    ph: 'Paste property information, e.g. “2-bedroom apartment at Marina Gate 2, Dubai Marina. Size 1,245 sqft. Asking price AED 3,150,000.”',
    action: 'Process & Autofill Listing',
    upload: 'Upload documents',
    typeHint: 'PDF, TXT, JPG, PNG or WebP — brochures, floor plans, title deeds, photos',
    linkHint: 'Listing page, website or shared document',
    steps: ['Reading uploaded documents', 'Fetching supported information', 'Extracting property details', 'Matching extracted values to form fields'],
    noun: 'listing',
    thing: 'property',
  },
  'broker-profile': {
    heading: 'Complete Your Profile Faster with AI',
    desc: 'Upload your CV or professional documents, paste your profile information, or add links to your website and social profiles. Our AI-assisted workflow helps extract available details and fill your profile form.',
    cta: 'Fill Profile with AI',
    panel: 'Fill Profile with AI',
    support: 'Add your professional information, documents, or links to automatically populate your profile form.',
    ph: 'Paste profile information, e.g. “Senior Real Estate Consultant, 9 years in Dubai Marina and Business Bay. BRN 48213. Speaks English and Arabic.”',
    action: 'Process & Autofill Profile',
    upload: 'Upload CV',
    typeHint: 'PDF, TXT, JPG or PNG — CV, certificates, business card',
    linkHint: 'Your website, agency team page or public profile',
    steps: ['Reading uploaded documents', 'Checking links', 'Extracting profile details', 'Matching extracted values to form fields'],
    noun: 'profile',
    thing: 'profile',
  },
  'agency-profile': {
    heading: 'Complete Your Agency Profile Faster with AI',
    desc: 'Upload your company profile or documents, paste agency information, or add links to your website and social pages. Our AI-assisted workflow helps extract available details and fill your agency profile form.',
    cta: 'Fill Profile with AI',
    panel: 'Fill Agency Profile with AI',
    support: 'Add your agency information, documents, or links to automatically populate your agency profile form.',
    ph: 'Paste agency information, e.g. “Founded in 2014. ORN 30418. Sales, off-plan and leasing teams covering Palm Jumeirah and Dubai Marina.”',
    action: 'Process & Autofill Profile',
    upload: 'Upload company profile',
    typeHint: 'PDF, TXT, JPG or PNG — company profile, licences, brochures',
    linkHint: 'Your agency website or public company page',
    steps: ['Reading uploaded documents', 'Checking links', 'Extracting profile details', 'Matching extracted values to form fields'],
    noun: 'profile',
    thing: 'agency',
  },
  'developer-profile': {
    heading: 'Complete Your Developer Profile Faster with AI',
    desc: 'Upload your company profile or project brochures, paste company information, or add links to your website and social pages. Our AI-assisted workflow helps extract available details and fill your developer profile form.',
    cta: 'Fill Profile with AI',
    panel: 'Fill Developer Profile with AI',
    support: 'Add your company information, documents, or links to automatically populate your developer profile form.',
    ph: 'Paste company information, e.g. “Established in 2005. 40+ projects delivered across Dubai Hills Estate and Business Bay. Apartments, villas and master communities.”',
    action: 'Process & Autofill Profile',
    upload: 'Upload company profile',
    typeHint: 'PDF, TXT, JPG or PNG — company profile, brochures, fact sheets',
    linkHint: 'Your company website or public developer page',
    steps: ['Reading uploaded documents', 'Checking links', 'Extracting company details', 'Matching extracted values to form fields'],
    noun: 'profile',
    thing: 'company',
  },
};
const TYPES: Record<string, string> = { pdf: 'PDF', txt: 'Text', jpg: 'Image', jpeg: 'Image', png: 'Image', webp: 'Image' };
const TYPE_ICON: Record<string, string> = { PDF: 'file-earmark-pdf', Text: 'file-earmark-text', Image: 'file-earmark-image' };
// Matches the server limits in /api/listing-autofill and /api/profile-autofill (22 MB keeps one request under 32 MB).
const MAX_FILE = 20 * 1048576, MAX_TOTAL = 22 * 1048576, MAX_ITEMS = 12, MAX_LINKS = 5, MAX_TEXT = 60000;

type Res = { id: string; kind: 'file' | 'link'; name: string; size?: number; type?: string; file?: File; url?: string; state: 'ready' | 'error' | 'processing' | 'read' | 'used' | 'notread'; msg?: string };
type StepState = 'wait' | 'run' | 'ok' | 'warn' | 'err' | 'skip';
const STATE: Record<Res['state'], [string, string, string]> = {
  ready: ['aif-st--ready', 'check2', 'Ready'],
  error: ['aif-st--error', 'x-octagon', 'Error'],
  read: ['aif-st--ok', 'check2-circle', 'Read'],
  used: ['aif-st--ok', 'check2-circle', 'Added'],
  notread: ['aif-st--error', 'x-octagon', 'Not read'],
  processing: ['aif-st--busy', 'arrow-repeat', 'Processing'],
};
const STEP_ICON: Record<StepState, string> = { wait: 'circle', run: 'arrow-repeat', ok: 'check-circle-fill', warn: 'exclamation-triangle-fill', err: 'x-octagon-fill', skip: 'dash-circle' };
const STEP_LABEL: Record<StepState, string> = { wait: 'Waiting', run: 'In progress', ok: 'Done', warn: 'Partly done', err: 'Failed', skip: 'Nothing to do' };
const fmtSize = (b: number) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
let n = 0;
const uid = () => 'res' + ++n + Date.now().toString(36);
const URL_RX = /\bhttps?:\/\/[^\s<>"')]+|\bwww\.[^\s<>"')]+/gi;

function collectCandidates(sources: { label: string; suggestions: Record<string, unknown> }[]) {
  const cmp = (v: unknown) =>
    Array.isArray(v) ? v.map((x: any) => (x && typeof x === 'object' ? `${x.label || ''}:${x.value || ''}` : String(x)).trim().toLowerCase()).sort().join('|') : v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const out: Candidates = {};
  for (const s of sources)
    for (const [k, v] of Object.entries(s.suggestions || {})) {
      out[k] ||= [];
      const hit = out[k].find((c) => cmp(c.value) === cmp(v));
      if (hit) hit.sources.push(s.label);
      else out[k].push({ value: v, sources: [s.label] });
    }
  return out;
}

export function AiAutofill({ context, current, onApply, onReview, onUndo, onManual, hideSummary = false, id = 'ai-autofill', defaultOpen = false }: Props) {
  const C = COPY[context];
  const { out: noCredits } = useAiCredits();
  const [open, setOpen] = useState(defaultOpen);
  const [entering, setEntering] = useState(false);
  const [res, setRes] = useState<Res[]>([]);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [steps, setSteps] = useState<[StepState, string][] | null>(null);
  const [result, setResult] = useState<null | { ok: true; sum: AiSummary; notes: number } | { ok: false; message: string }>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const urlIn = useRef<HTMLInputElement>(null);
  const plusWrap = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    request.current?.abort();
    timers.current.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !plusWrap.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);
  /* auto-grow the textarea (76–240px) */
  useEffect(() => {
    const t = ta.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = Math.min(Math.max(t.scrollHeight, 76), 240) + 'px';
  }, [text, open]);

  const reduce = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = (on: boolean) => {
    setOpen(on);
    if (on) {
      setEntering(!reduce());
      setTimeout(() => {
        ta.current?.focus();
        document.getElementById(id + '-panel')?.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'nearest' });
      }, 30);
    }
  };
  const valid = res.filter((r) => r.state !== 'error');

  const addFiles = (list: FileList | File[]) => {
    const errs: string[] = [];
    const next = res.slice();
    Array.from(list).forEach((f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase(), type = TYPES[ext];
      if (next.length >= MAX_ITEMS) return errs.push(`You can add up to ${MAX_ITEMS} items.`);
      if (next.some((r) => r.kind === 'file' && r.name === f.name && r.size === f.size)) return errs.push(f.name + ' is already attached.');
      const r: Res = { id: uid(), kind: 'file', name: f.name, size: f.size, type: type || ext.toUpperCase() || 'File', file: f, state: 'ready' };
      const total = next.reduce((s, x) => s + (x.state !== 'error' ? x.size || 0 : 0), 0);
      if (!type) Object.assign(r, { state: 'error', msg: 'Unsupported format. Use ' + C.typeHint.split(' — ')[0] + '.' });
      else if (f.size > MAX_FILE) Object.assign(r, { state: 'error', msg: 'Larger than 20 MB.' });
      else if (total + f.size > MAX_TOTAL) Object.assign(r, { state: 'error', msg: 'Attachments can total up to 22 MB.' });
      next.push(r);
    });
    setRes(next);
    setErr(errs.filter((x, i) => errs.indexOf(x) === i).join(' '));
  };
  /** Returns an error message, or '' when the link was added. */
  const addLink = (raw: string, list = res): [string, Res[]] => {
    let v = (raw || '').trim();
    if (!v) return ['Paste a link first.', list];
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    let u: URL;
    try {
      u = new URL(v);
    } catch {
      return ['That isn’t a valid web address.', list];
    }
    if (!/^https?:$/.test(u.protocol) || !/\.[a-z]{2,}$/i.test(u.hostname) || /^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname)) return ['Use a public web address, like https://example.com/property.', list];
    if (list.some((r) => r.url === u.href)) return ['That link is already added.', list];
    if (list.length >= MAX_ITEMS) return [`You can add up to ${MAX_ITEMS} items.`, list];
    if (list.filter((r) => r.kind === 'link').length >= MAX_LINKS) return [`You can add up to ${MAX_LINKS} links per run.`, list];
    const h = u.hostname.replace(/^www\./, '');
    return ['', [...list, { id: uid(), kind: 'link', url: u.href, name: h + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : ''), state: 'ready' }]];
  };
  const submitLink = () => {
    const [m, next] = addLink(url);
    setErr(m);
    if (!m) {
      setRes(next);
      setUrl('');
      urlIn.current?.focus();
    }
  };

  /* ---------------- processing ---------------- */
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    timers.current.forEach(clearTimeout);
    setBusy(false);
    setSteps(null);
    setStatus('');
    setRes((rs) => rs.map((r) => (r.state === 'processing' ? { ...r, state: 'ready', msg: '' } : r)));
  };
  const process = async () => {
    if (busy) return;
    let list = res;
    if (urlOpen && url.trim()) {
      const [m, next] = addLink(url, list);
      if (m) return setErr(m);
      list = next;
      setUrl('');
      setUrlOpen(false);
    }
    /* URLs typed or pasted into the text become link resources too */
    for (const u of text.match(URL_RX) || []) list = addLink(u.replace(/[.,;]+$/, ''), list)[1];
    const body = text.replace(URL_RX, ' ').trim();
    const items = list.filter((r) => r.state !== 'error');
    if (!body && !items.length) {
      setErr(`Add documents, paste ${C.thing} information or add a link first.`);
      ta.current?.focus();
      return;
    }
    const files = items.filter((r) => r.kind === 'file');
    const links = items.filter((r) => r.kind === 'link');
    setErr('');
    setResult(null);
    setBusy(true);
    setRes(list.map((r) => (r.state !== 'error' ? { ...r, state: 'processing', msg: '' } : r)));
    setStatus('Processing your resources…');
    const st: [StepState, string][] = C.steps.map(() => ['wait', ''] as [StepState, string]);
    const paint = () => setSteps(st.map((s) => [...s] as [StepState, string]));
    const docsDetail = [files.length ? files.length + (files.length === 1 ? ' document' : ' documents') : '', body ? 'your pasted text' : ''].filter(Boolean).join(' and ');
    st[0] = files.length || body ? ['run', 'Reading ' + docsDetail] : ['skip', 'No documents attached'];
    if (st[0][0] === 'skip') st[1] = links.length ? ['run', ''] : ['skip', 'No links added'];
    paint();
    /* the server does everything in one request; the steps advance as it works and settle on the real result */
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, reduce() ? 0 : ms));
    later(1400, () => {
      if (st[0][0] === 'run') st[0] = ['ok', docsDetail + ' sent for reading'];
      st[1] = links.length ? ['run', 'Opening ' + links.length + (links.length === 1 ? ' link' : ' links')] : ['skip', 'No links added'];
      paint();
    });
    later(3200, () => {
      if (st[1][0] === 'run') st[1] = ['ok', links.length + (links.length === 1 ? ' link' : ' links') + ' requested'];
      st[2] = ['run', 'This can take up to a minute for long documents'];
      paint();
    });

    const controller = new AbortController();
    request.current = controller;
    try {
      const form = new FormData();
      for (const r of files) form.append('files', r.file as File);
      for (const r of links) form.append('website', r.url as string);
      if (body) form.set('text', body.slice(0, MAX_TEXT));
      form.set('profile', JSON.stringify(current || {}));
      const response = await fetch(context === 'listing' ? '/api/listing-autofill' : '/api/profile-autofill', { method: 'POST', body: form, credentials: 'same-origin', signal: controller.signal });
      const out = await readAiResponse(response);
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(out.error || 'Could not analyze those resources.');
      const sources = (Array.isArray(out.sources) ? out.sources : []).filter((s: any) => s && typeof s.label === 'string' && s.suggestions && typeof s.suggestions === 'object');
      const candidates = collectCandidates(sources);
      const chosen: Record<string, any> = {};
      for (const [k, v] of Object.entries(candidates)) chosen[k] = v[0].value;
      timers.current.forEach(clearTimeout);
      st[0] = files.length || body ? ['ok', docsDetail + ' read'] : ['skip', 'No documents attached'];
      st[1] = links.length ? ['ok', links.length + (links.length === 1 ? ' link' : ' links') + ' read'] : ['skip', 'No links added'];
      const found = Object.keys(chosen).length;
      if (!found) throw new Error(`No ${C.thing} details were recognised in what you shared.`);
      const conflicting = Object.values(candidates).filter((v) => v.length > 1).length;
      st[2] = ['ok', found + ' detail' + (found === 1 ? '' : 's') + ' found' + (sources.length > 1 ? ' across ' + sources.length + ' sources' : '') + (conflicting ? ' · ' + conflicting + ' differ between sources' : '')];
      st[3] = ['run', ''];
      paint();
      setRes((rs) => rs.map((r) => (r.state === 'processing' ? { ...r, state: r.kind === 'link' ? 'used' : 'read' } : r)));
      const photos: AiFoundPhotos = {
        files: files.filter((r) => r.type === 'Image' && r.file).map((r) => r.file as File),
        links: (Array.isArray(out.images) ? out.images : []).filter((i: any) => i && typeof i.url === 'string' && /^https?:\/\//.test(i.url)).map((i: any) => ({ url: i.url, source: String(i.source || ''), other: i.other === true })),
      };
      const sum = await onApply(chosen, Object.keys(chosen), candidates, photos);
      const review = (sum.missing || 0) + (sum.review || 0);
      st[3] = [review || sum.errors ? 'warn' : 'ok', sum.filled + ' filled · ' + review + ' need your input' + (sum.errors ? ' · ' + sum.errors + ' error' + (sum.errors === 1 ? '' : 's') : '') + (sum.kept ? ' · ' + sum.kept + ' of your entries kept' : '')];
      paint();
      setStatus('Processing finished.');
      setResult({ ok: true, sum: { ...sum, missing: review }, notes: (out.warnings || []).length });
    } catch (e) {
      if (controller.signal.aborted) return;
      timers.current.forEach(clearTimeout);
      const message = e instanceof Error ? e.message : 'Could not analyze those resources.';
      const i = st.findIndex((s) => s[0] === 'run');
      if (i > -1) st[i] = ['err', message];
      paint();
      setRes((rs) => rs.map((r) => (r.state === 'processing' ? { ...r, state: 'notread', msg: 'Nothing from this resource was used.' } : r)));
      setStatus('Processing finished — nothing was added to your form.');
      setResult({ ok: false, message });
    } finally {
      if (request.current === controller) request.current = null;
      setBusy(false);
      setTimeout(() => resultRef.current?.focus({ preventScroll: true }), 30);
    }
  };

  const undo = () => {
    onUndo?.();
    setResult(null);
    setSteps(null);
    setStatus('');
    setRes((rs) => rs.map((r) => (r.state !== 'error' ? { ...r, state: 'ready', msg: '' } : r)));
  };
  const onMenuKey = (e: React.KeyboardEvent) => {
    const b = Array.from(menuRef.current?.querySelectorAll('button') || []);
    const i = b.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      setMenu(false);
      plusWrap.current?.querySelector<HTMLButtonElement>('.aif-circle')?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      b[(i + 1) % b.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      b[(i - 1 + b.length) % b.length]?.focus();
    }
  };
  const pick = (what: 'file' | 'url') => {
    setMenu(false);
    if (what === 'url') {
      setUrlOpen(true);
      setErr('');
      setTimeout(() => urlIn.current?.focus(), 0);
    } else fileIn.current?.click();
  };
  const canGo = !busy && !noCredits && (!!text.trim() || !!valid.length || (urlOpen && !!url.trim()));

  const tag = (cls: string, icon: string, label: ReactNode) => (
    <li className={'ai-tag ' + cls + ' is-static'}>
      <Icon name={icon} />
      {label}
    </li>
  );

  return (
    <div className={'e8p e8p--ai' + (open ? ' is-open' : '') + (busy ? ' is-busy' : '')} data-ai-autofill={context}>
      <section className="ai-banner ai-banner--listing aif-banner" aria-labelledby={id + '-bt'}>
        <div className="ai-banner__aura" aria-hidden="true" />
        <AiCreditsCard />
        <div className="ai-banner__content">
          <div className="ai-banner__badges">
            <span className="ai-badge ai-badge--new">
              <Icon name="stars" />
              New feature
            </span>
          </div>
          <h2 className="ai-banner__title" id={id + '-bt'}>
            {C.heading}
          </h2>
          <p className="ai-banner__desc">{C.desc}</p>
          <div className="ai-banner__actions">
            <button className="btn btn-lg btn-ai" type="button" aria-expanded={open} aria-controls={id + '-panel'} onClick={() => toggle(!open)}>
              <Icon name="stars" />
              {C.cta}
            </button>
            {onManual && (
              <button className="btn btn-lg btn-outline" type="button" onClick={onManual}>
                Enter details manually
                <Icon name="arrow-right" />
              </button>
            )}
          </div>
          <p className="ai-banner__note">
            <Icon name="shield-check" />
            Review the extracted details before publishing.
          </p>
        </div>
        <div className="ai-banner__visual" aria-hidden="true">
          <div className="ai-doc">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="ai-orb-wrap" style={{ '--orb-size': '140px' } as React.CSSProperties}>
            <div className="ai-orb">
              <span className="ai-orb__rim" />
            </div>
          </div>
          <span className="ai-sparkle" style={{ left: '72%', top: '16%', '--s': '11px', '--d': '.6s' } as React.CSSProperties} />
          <span className="ai-sparkle" style={{ left: '88%', top: '52%', '--s': '8px', '--d': '2.4s' } as React.CSSProperties} />
        </div>
      </section>

      <div className={'aif-panel' + (entering ? ' is-entering' : '')} id={id + '-panel'} hidden={!open} onAnimationEnd={() => setEntering(false)}>
        <div className="aif-panel__head">
          <span className="aif-orb" aria-hidden="true" />
          <div>
            <h3 id={id + '-pt'} tabIndex={-1}>
              {C.panel}
            </h3>
            <p>{C.support}</p>
          </div>
          <button type="button" className="aif-x" aria-label={'Close ' + C.panel} onClick={() => toggle(false)}>
            <Icon name="x-lg" />
          </button>
        </div>
        <form
          className={'aif-composer' + (drag ? ' is-drag' : '')}
          noValidate
          aria-labelledby={id + '-pt'}
          aria-busy={busy || undefined}
          onSubmit={(e) => {
            e.preventDefault();
            process();
          }}
          onDragEnter={(e) => {
            if (Array.from(e.dataTransfer.types).includes('Files')) {
              e.preventDefault();
              setDrag(true);
            }
          }}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <div className="aif-drop" aria-hidden="true">
            <span>
              <Icon name="cloud-arrow-up" />
              Drop files to attach
            </span>
          </div>
          {!!res.length && (
            <ul className="aif-res" aria-label="Attached resources">
              {res.map((r) => {
                const s = STATE[r.state];
                const bad = r.state === 'error' || r.state === 'notread';
                return (
                  <li key={r.id} className={'aif-chip' + (bad ? ' is-error' : '')}>
                    <Icon name={r.kind === 'link' ? 'link-45deg' : TYPE_ICON[r.type || ''] || 'file-earmark'} className="aif-chip__ic" />
                    <span className="aif-chip__txt">
                      <b title={r.name}>{r.name}</b>
                      <span className="aif-chip__meta">
                        <span className={'aif-st ' + s[0]}>
                          <Icon name={s[1]} />
                          {s[2]}
                        </span>
                        <small>{r.kind === 'link' ? 'Link' : r.type + ' · ' + fmtSize(r.size || 0)}</small>
                      </span>
                      {r.msg && <small className="aif-chip__msg">{r.msg}</small>}
                    </span>
                    {!busy && (
                      <button type="button" className="aif-chip__rm" aria-label={'Remove ' + r.name} onClick={() => { setRes(res.filter((x) => x.id !== r.id)); ta.current?.focus(); }}>
                        <Icon name="x" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {urlOpen && (
            <div className="aif-url">
              <label className="sr-only" htmlFor={id + '-u'}>
                Link to add
              </label>
              <input
                ref={urlIn}
                id={id + '-u'}
                type="url"
                inputMode="url"
                placeholder={'https://… ' + C.linkHint.toLowerCase()}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitLink();
                  }
                  if (e.key === 'Escape') {
                    setUrlOpen(false);
                    setUrl('');
                    setErr('');
                    ta.current?.focus();
                  }
                }}
              />
              <button type="button" className="btn btn-dark btn-sm" onClick={submitLink}>
                Add
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setUrlOpen(false); setUrl(''); setErr(''); ta.current?.focus(); }}>
                Cancel
              </button>
            </div>
          )}
          {err && (
            <p className="aif-err" role="alert">
              {err}
            </p>
          )}
          <label className="sr-only" htmlFor={id + '-t'}>
            {context === 'listing' ? 'Property information to extract from' : 'Profile information to extract from'}
          </label>
          <textarea
            ref={ta}
            id={id + '-t'}
            rows={3}
            placeholder={C.ph}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const s = e.clipboardData.getData('text');
              if (s && /^\s*(?:(?:https?:\/\/|www\.)\S+\s*)+$/i.test(s)) {
                e.preventDefault();
                let list = res;
                const errs: string[] = [];
                s.trim().split(/\s+/).forEach((u) => {
                  const [m, next] = addLink(u, list);
                  if (m) errs.push(m);
                  list = next;
                });
                setRes(list);
                setErr(errs.join(' '));
              }
            }}
          />
          <div className="aif-row">
            <div className="aif-plus" ref={plusWrap}>
              <button type="button" className="aif-circle" aria-label="Add documents or links" aria-haspopup="menu" aria-expanded={menu} aria-controls={id + '-m'} disabled={busy} onClick={() => { setMenu(!menu); if (!menu) setTimeout(() => menuRef.current?.querySelector('button')?.focus(), 0); }}>
                <Icon name="plus-lg" />
              </button>
              <div className="aif-menu" id={id + '-m'} role="menu" hidden={!menu} ref={menuRef} onKeyDown={onMenuKey}>
                <button type="button" role="menuitem" onClick={() => pick('file')}>
                  <Icon name="file-earmark-arrow-up" />
                  <span>
                    Upload documents<small>{C.typeHint}</small>
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={() => pick('url')}>
                  <Icon name="link-45deg" />
                  <span>
                    Paste a link<small>{C.linkHint}</small>
                  </span>
                </button>
              </div>
            </div>
            <button type="button" className="aif-pill" disabled={busy} onClick={() => pick('url')}>
              <Icon name="link-45deg" />
              Add link
            </button>
            <button type="button" className="aif-pill" disabled={busy} onClick={() => pick('file')}>
              <Icon name="file-earmark-arrow-up" />
              {C.upload}
            </button>
            <button type="submit" className="aif-go" disabled={!canGo}>
              <Icon name="stars" />
              <span>{busy ? 'Processing' : C.action}</span>
            </button>
          </div>
          <input
            ref={fileIn}
            type="file"
            className="file-hidden"
            multiple
            accept={Object.keys(TYPES).map((x) => '.' + x).join(',')}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </form>
        <p className="aif-limits">
          Up to {MAX_ITEMS} items ({MAX_LINKS} links) · 20 MB per file · 22 MB in total. Pasted text is input for extraction, not a message.
        </p>
        <AiCreditsBadge className="aif-credits" />

        {steps && (
          <div className="aif-progress">
            <p className="aif-progress__t" role="status" aria-live="polite">
              {status}
              {busy && (
                <button type="button" className="linkish" style={{ marginLeft: 10, fontSize: 12.5, fontWeight: 600, textDecoration: 'underline' }} onClick={cancel}>
                  Cancel
                </button>
              )}
            </p>
            <ol>
              {steps.map(([s, detail], i) => (
                <li key={i} className={'aif-step aif-step--' + s}>
                  <Icon name={STEP_ICON[s]} />
                  <span>
                    <b>{C.steps[i]}</b>
                    <span className="sr-only"> — {STEP_LABEL[s]}</span>
                    {detail && <small>{detail}</small>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {result && !(hideSummary && result.ok) && (
          <div className="aif-result" tabIndex={-1} ref={resultRef}>
            {result.ok ? (
              <div className="aif-sum">
                <Icon name="check2-circle" className="aif-sum__ic" />
                <div>
                  <b>Your {C.noun} form has been filled where values were found.</b>
                  <p>Review the highlighted fields before you save or publish. Nothing is published automatically.</p>
                  <ul className="aif-counts">
                    {tag('ai-tag--filled', 'stars', result.sum.filled + ' AI-Filled')}
                    {tag('ai-tag--missing', 'exclamation-triangle-fill', result.sum.missing + ' Needs Your Input')}
                    {!!result.sum.errors && tag('ai-tag--error', 'x-octagon-fill', result.sum.errors + ' Error')}
                    {!!result.sum.kept && tag('ai-tag--edited', 'pencil', result.sum.kept + ' Edited — kept')}
                  </ul>
                  {!!result.notes && (
                    <p className="aif-sum__warn">
                      <Icon name="info-circle" />
                      Some resources could only be partly read. Check the form for anything missing.
                    </p>
                  )}
                  <div className="aif-sum__act">
                    {onReview && (
                      <button type="button" className="btn btn-dark btn-sm" onClick={onReview}>
                        <Icon name="arrow-down" />
                        Review the form
                      </button>
                    )}
                    {onUndo && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={undo}>
                        <Icon name="arrow-counterclockwise" />
                        Undo autofill
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="aif-sum aif-sum--error" role="alert">
                <Icon name="x-octagon-fill" className="aif-sum__ic" />
                <div>
                  <b>Error: nothing could be extracted</b>
                  <p>
                    {'message' in result ? result.message : ''} Paste the {C.thing} details as text and process again, or fill in the form yourself. Your form hasn’t been changed.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
