'use client';

import { createContext, useContext, useEffect, useRef, type ComponentProps } from 'react';
import { Icon } from './Icon';
import { AiBadge, Field } from './Field';

export type AiFieldState = 'filled' | 'edited' | 'missing' | 'suggestion' | 'kept';
export type AiSuggestion = { value: any; sources?: string[]; options?: { value: any; sources: string[] }[] };
export type AiReviewValue = { states: Record<string, AiFieldState>; suggestions: Record<string, AiSuggestion>; use: (id: string) => void; keep: (id: string) => void; select: (id: string, value: any) => void; ran?: boolean };

const isBlankValue = (value: unknown) =>
  value == null || value === '' || value === false || (Array.isArray(value) && !value.length) ||
  (typeof value === 'object' && !Array.isArray(value) && 'raw' in (value as any) && ((value as any).raw == null || (value as any).raw === ''));

/** State for a field after an AI run: an explicit state wins; otherwise blank = missing, filled = not from AI. */
function stateFor(review: AiReviewValue, id: string, hasValue: boolean, value: unknown): AiFieldState | undefined {
  if (review.suggestions?.[id]) return 'suggestion';
  if (review.states?.[id]) return review.states[id];
  if (!review.ran || !hasValue) return undefined;
  return isBlankValue(value) ? 'missing' : 'kept';
}

/** Badge-only status for list widgets (amenities, photos, milestones…) after an AI run. */
export function AiStatus({ id, value, optional }: { id: string; value: unknown; optional?: boolean }) {
  const review = useContext(AiReviewContext);
  const state = review && typeof review === 'object' && 'states' in review ? stateFor(review, id, true, value) : undefined;
  return state ? <AiBadge state={state} optional={optional ? 'optional' : undefined} /> : null;
}
export const AiReviewContext = createContext<AiReviewValue>({ states: {}, suggestions: {}, use: () => {}, keep: () => {}, select: () => {} });

export function AiField(allProps: ComponentProps<typeof Field> & { value?: unknown }) {
  // Passing `value` (even blank) opts the field into the "missing / not from AI" states after an AI run.
  const { value, ...props } = allProps;
  const hasValue = Object.prototype.hasOwnProperty.call(allProps, 'value');
  const contextValue = useContext(AiReviewContext);
  // Keep fields resilient to a stale provider value during Next.js Fast Refresh.
  const review: AiReviewValue = contextValue && typeof contextValue === 'object' && 'states' in contextValue
    ? contextValue
    : { states: contextValue as unknown as Record<string, AiFieldState>, suggestions: {}, use: () => {}, keep: () => {}, select: () => {} };
  const id = props.id || '';
  const suggestion = review.suggestions?.[id];
  const state = stateFor(review, id, !!hasValue, value);
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
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8d5fb] bg-white/90 px-3 py-1.5 font-semibold text-[#5142a7]"><Icon name="stars" />{filled} AI-filled</span><span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/90 px-3 py-1.5 font-semibold text-muted"><Icon name="pencil" />{edited} edited</span>{missing > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ef9a92] bg-[#fff4f2] px-3 py-1.5 font-semibold text-[#b42318]"><Icon name="exclamation-circle" />{missing} required {missing === 1 ? 'field needs' : 'fields need'} your input</span>}{review > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f0d7a8] bg-[#fffaf0] px-3 py-1.5 font-semibold text-warn"><Icon name="lightbulb" />{review} AI {review === 1 ? 'suggestion' : 'suggestions'} to review</span>}</div>
    </div>
    <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 -z-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(141,132,255,0.24),transparent_68%)] blur-lg" />
    <button type="button" className="relative z-10 btn btn-ghost btn-sm" onClick={onUndo}><Icon name="arrow-counterclockwise" />Undo AI changes</button>
  </div>;
}
