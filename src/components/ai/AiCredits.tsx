'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/Icon';
import './ai-credits.css';

/* AI-credit balance shared by every AI widget on the page (listing autofill, profile autofill, translation).
 * Loaded once from /api/ai-credits; AI routes return `credits` with each answer, which updates every view. */

export type AiCredits = { allowance: number; used: number; remaining: number; resetsAt: string; shared: boolean; enforced: boolean };

let state: AiCredits | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function setAiCredits(next: unknown) {
  if (!next || typeof next !== 'object' || typeof (next as AiCredits).remaining !== 'number') return;
  state = next as AiCredits;
  emit();
}

export function refreshAiCredits() {
  loading ||= fetch('/api/ai-credits', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => setAiCredits(json?.credits))
    .catch(() => {})
    .finally(() => { loading = null; });
  return loading;
}

/** Read an AI route's JSON reply and pick up the balance it carries (success, 402 and other errors alike). */
export async function readAiResponse(response: Response) {
  const json = await response.json().catch(() => ({}));
  setAiCredits(json?.credits);
  return json;
}

export function useAiCredits() {
  const credits = useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => state,
    () => null,
  );
  useEffect(() => {
    if (!state) refreshAiCredits();
  }, []);
  return { credits, out: Boolean(credits && credits.enforced && credits.remaining <= 0) };
}

const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString('en-US');
const resetDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Normal, low (10% or less left) or out. Low and out also change the icon and wording, never colour alone. */
function levelOf(c: AiCredits) {
  if (c.enforced && c.remaining <= 0) return 'out' as const;
  if (c.allowance > 0 && c.remaining / c.allowance <= 0.1) return 'low' as const;
  return 'ok' as const;
}

/** Counts from the previous value to `to` (from 0 on first show). */
function useCountUp(to: number, ms = 1100) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const dur = reducedMotion() ? 0 : ms;
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = dur ? Math.min(1, (now - start) / dur) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (to - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = to; };
  }, [to, ms]);
  return shown;
}

/** Animated donut: the coloured arc is what is left this month; the pale track is what has been used. */
export function AiCreditsRing({ credits, size = 64, stroke = 7, showCenter = true }: { credits: AiCredits; size?: number; stroke?: number; showCenter?: boolean }) {
  const id = useId().replace(/:/g, '');
  const level = levelOf(credits);
  const fraction = credits.allowance > 0 ? Math.min(1, Math.max(0, credits.remaining / credits.allowance)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Start empty, then fill to the real value on the next frame so the arc animates in.
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(fraction));
    return () => cancelAnimationFrame(raf);
  }, [fraction]);
  const pct = useCountUp(Math.round(fraction * 100));
  const arc = drawn * c;
  const stops =
    level === 'low' ? ['#fbbf24', '#f59e0b', '#ea580c'] : ['var(--aic-sky)', 'var(--aic-indigo)', 'var(--aic-violet)'];
  return (
    <span className="aic-ring" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={'aic-g' + id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="55%" stopColor={stops[1]} />
            <stop offset="100%" stopColor={stops[2]} />
          </linearGradient>
        </defs>
        <circle className="aic-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        {fraction > 0 && (
          <circle
            className="aic-ring__arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            stroke={`url(#aic-g${id})`}
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c - arc}
          />
        )}
        {fraction > 0.06 && size >= 40 && (
          <circle
            className="aic-ring__glint"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={Math.max(2, stroke - 4)}
            strokeDasharray={`${c * 0.05} ${c}`}
            style={{ ['--aic-run' as string]: `${Math.max(0, fraction * c - c * 0.05)}px` }}
          />
        )}
      </svg>
      {showCenter && (
        <span className="aic-ring__center" style={{ fontSize: Math.round(size * 0.24) }}>
          {Math.round(pct)}%
        </span>
      )}
    </span>
  );
}

function describe(c: AiCredits) {
  return `${fmt(c.remaining)} of ${fmt(c.allowance)} AI credits left this month${c.shared ? ' on the agency plan' : ''}, ${fmt(c.used)} used. Resets ${resetDate(c.resetsAt)}.`;
}

/** Glass card for the top-right corner of an AI banner (the banner must be position: relative). */
export function AiCreditsCard() {
  const { credits } = useAiCredits();
  const remaining = useCountUp(credits?.remaining ?? 0);
  if (!credits) return null;
  const level = levelOf(credits);
  return (
    <div className={'aic aic-card is-' + level} role="status" aria-live="polite" aria-label={describe(credits)} title={describe(credits)}>
      <AiCreditsRing credits={credits} />
      <div>
        <p className="aic-card__label">
          <Icon name={level === 'out' ? 'exclamation-octagon-fill' : level === 'low' ? 'exclamation-triangle-fill' : 'stars'} />
          {level === 'out' ? 'No AI credits left' : level === 'low' ? 'AI credits running low' : credits.shared ? 'Agency AI credits' : 'AI credits'}
        </p>
        <p className="aic-card__value">
          {fmt(remaining)}
          <small>/ {fmt(credits.allowance)} left</small>
        </p>
        <p className="aic-card__meta">
          {level === 'out' ? (
            <>
              Resets {resetDate(credits.resetsAt)} · <Link href="/subscription">Upgrade</Link>
            </>
          ) : (
            <>
              Resets {resetDate(credits.resetsAt)}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Compact line with a small ring, for places without room for the card (translate button, upload panel). */
export function AiCreditsBadge({ className = '' }: { className?: string }) {
  const { credits } = useAiCredits();
  if (!credits) return null;
  const level = levelOf(credits);
  return (
    <p className={'aic aic-inline is-' + level + ' ' + className} role="status" aria-live="polite" title={describe(credits)}>
      <AiCreditsRing credits={credits} size={22} stroke={4} showCenter={false} />
      {level === 'out' ? (
        <span>
          <b>No AI credits left this month</b>{credits.shared ? ' on your agency plan' : ''} · resets {resetDate(credits.resetsAt)} ·{' '}
          <Link href="/subscription">Upgrade plan</Link> · you can still enter details manually.
        </span>
      ) : (
        <span>
          {level === 'low' && <Icon name="exclamation-triangle-fill" />} <b>{fmt(credits.remaining)}</b> of {fmt(credits.allowance)} AI credits left
          {credits.shared ? ' (agency pool)' : ''} · resets {resetDate(credits.resetsAt)}
        </span>
      )}
    </p>
  );
}
