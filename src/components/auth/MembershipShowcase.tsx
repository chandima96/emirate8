'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PublicPlan } from '@/lib/publicStore';
import { cx } from '@/lib/utils';

/*
 * Full-screen membership showcase for the registration wizard's membership step.
 *
 * Motion patterns are drawn from plan pickers catalogued on Mobbin:
 *   - Google Workspace "Compare plans": a single card expands into the full comparison
 *     → here the overlay grows out of the step (clip-path) and shrinks back into the chosen card.
 *   - Deputy "Choose your plan": full-screen chooser with "Everything in Lite, plus" columns.
 *   - Going / Save.design: comparison table with the selected tier's column highlighted.
 *   - MasterClass: selectable tier cards with a sticky "Continue" bar.
 */

type Props = {
  plans: PublicPlan[];
  selected: string;
  onSelect: (id: string) => void;
  /** Called after the closing animation finishes. */
  onClose: () => void;
  /** Where the overlay grows from (usually the membership step or the clicked button). */
  originRect: DOMRect | null;
  /** Where the overlay shrinks back to (the compact card of the chosen plan). */
  targetRect: (id: string) => DOMRect | null;
  audienceLabel: string;
};

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const TIER_TONE: Record<string, string> = {
  Bronze: 'linear-gradient(135deg,#e2b48b 0%,#a8693e 55%,#6f4122 100%)',
  Silver: 'linear-gradient(135deg,#f3f5f5 0%,#b7c1c3 55%,#7d898c 100%)',
  Gold: 'linear-gradient(135deg,#f6e2a6 0%,#d1a548 55%,#94701f 100%)',
};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const insetFor = (r: DOMRect | null, radius = 12) => {
  if (!r) return 'inset(50% 50% 50% 50% round 24px)';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return `inset(${Math.max(0, r.top)}px ${Math.max(0, vw - r.right)}px ${Math.max(0, vh - r.bottom)}px ${Math.max(0, r.left)}px round ${radius}px)`;
};

/** Plain-language label for a quantity that may be "unlimited" (null). */
const qty = (n: number | null | undefined, open: string) => (n == null ? open : n.toLocaleString());

type Metric = { key: 'seats' | 'listings' | 'selections' | 'aiCredits'; label: string; open: string };

function metricsFor(audience: string, list: PublicPlan[]): Metric[] {
  const all: Metric[] = [
    { key: 'seats', label: 'Team seats', open: 'Configurable' },
    { key: 'listings', label: audience === 'developer' ? 'Active properties' : 'Active listings', open: 'Flexible' },
    { key: 'selections', label: 'Network selections', open: 'Unlimited' },
    { key: 'aiCredits', label: 'AI credits / month', open: 'Unlimited' },
  ];
  // Hide a metric when no tier uses it (developers have no network selections).
  return all.filter((m) => list.some((p) => p[m.key] == null || Number(p[m.key]) > 0));
}

/** Features that are not already shown as a number in the metric bars. */
const isQuantity = (f: string) => /\d|seat|configurable|flexible/i.test(f);

/* ----------------------------------------------------------------------- */

export function MembershipShowcase({ plans, selected, onSelect, onClose, originRect, targetRect, audienceLabel }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closing = useRef(false);
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing'>('opening');
  const [glide, setGlide] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const metrics = metricsFor(plans[0]?.roleAudience || '', plans);
  const current = plans.find((p) => p.id === selected) || plans[0];

  /* ---------- Open: grow from the origin ---------- */
  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    // Start bars and counters on the next frame so their transitions run from zero.
    const raf = requestAnimationFrame(() => setMounted(true));
    const anim = el.animate([{ clipPath: insetFor(originRect) }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], {
      duration: reducedMotion() ? 0 : 720,
      easing: EASE,
    });
    anim.onfinish = () => setPhase('open');
    return () => {
      cancelAnimationFrame(raf);
      anim.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Close: shrink into the chosen plan's compact card ---------- */
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setPhase('closing');
    const el = shellRef.current;
    if (!el || reducedMotion()) {
      onClose();
      return;
    }
    el.scrollTop = el.scrollTop; // keep position while clipping
    const anim = el.animate(
      [{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: insetFor(targetRect(selected) || originRect, 10) }],
      { duration: 560, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards', delay: 120 },
    );
    anim.onfinish = onClose;
  }, [onClose, originRect, selected, targetRect]);

  /* ---------- Scroll lock, Escape, focus trap ---------- */
  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.documentElement.style.overflow = 'hidden';
    const first = shellRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !shellRef.current) return;
      const f = [...shellRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),[href],[tabindex="0"]')].filter(
        (n) => n.offsetParent !== null,
      );
      if (!f.length) return;
      const a = f[0];
      const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [close]);

  /* ---------- Sliding highlight behind the selected tier ---------- */
  useLayoutEffect(() => {
    const measure = () => {
      const card = cardRefs.current[selected];
      if (!card) return;
      setGlide({ x: card.offsetLeft, y: card.offsetTop, w: card.offsetWidth, h: card.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [selected, plans.length]);

  const pick = (id: string, scroll = false) => {
    onSelect(id);
    if (scroll) cardRefs.current[id]?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  };

  const onRadioKeys = (e: React.KeyboardEvent) => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = plans.findIndex((p) => p.id === selected);
    const n = plans[(i + d + plans.length) % plans.length];
    pick(n.id, true);
    requestAnimationFrame(() => cardRefs.current[n.id]?.focus());
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={shellRef}
      className={cx('ms-shell', `is-${phase}`)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ms-title"
    >
      <div className="ms-glow" aria-hidden="true" />

      {/* Top bar */}
      <header className="ms-top">
        <span className="ms-rise text-[12px] font-semibold tracking-[.14em] text-sage uppercase" style={{ '--d': 0 } as React.CSSProperties}>
          Step 3 · Membership
        </span>
        <button type="button" className="ms-close" onClick={close} aria-label="Close plan details" data-autofocus>
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </header>

      <div className="mx-auto w-full max-w-[1180px] px-4 pb-40 sm:px-8">
        {/* Heading */}
        <div className="pt-6 text-center sm:pt-10">
          <h2 id="ms-title" className="ms-rise font-display text-[30px] leading-[1.08] font-semibold text-white sm:text-[44px]" style={{ '--d': 1 } as React.CSSProperties}>
            Choose your <em className="f font-normal text-sage">membership.</em>
          </h2>
          <p className="ms-rise mx-auto mt-3 max-w-[520px] text-[14px] leading-[1.6] text-[#B9C4C1] sm:text-[15px]" style={{ '--d': 2 } as React.CSSProperties}>
            Every {audienceLabel} plan includes your public profile and secure workspace. Pick the tier that fits how you
            work today — you can change it any time.
          </p>
        </div>

        {/* Mobile tier switcher */}
        <div className="ms-rise mt-7 flex justify-center lg:hidden" style={{ '--d': 3 } as React.CSSProperties}>
          <div className="ms-tabs" role="tablist" aria-label="Membership tiers">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === selected}
                tabIndex={-1}
                className="ms-tab"
                onClick={() => pick(p.id, true)}
              >
                <span className="ms-medal h-2.5 w-2.5" style={{ background: TIER_TONE[p.name] }} aria-hidden="true" />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tier columns */}
        <div
          ref={trackRef}
          className="ms-track"
          role="radiogroup"
          aria-label="Membership plan"
          onKeyDown={onRadioKeys}
        >
          {glide && (
            <div
              className="ms-glide"
              aria-hidden="true"
              style={{ transform: `translate3d(${glide.x}px, ${glide.y}px, 0)`, width: glide.w, height: glide.h }}
            />
          )}
          {plans.map((p, i) => {
            const prev = plans[i - 1];
            const extras = (p.features || []).filter((f) => !isQuantity(f) && !(prev?.features || []).includes(f));
            const on = p.id === selected;
            return (
              <div
                key={p.id}
                ref={(el) => {
                  cardRefs.current[p.id] = el;
                }}
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                className={cx('ms-card ms-rise', on && 'is-on')}
                style={{ '--d': 4 + i } as React.CSSProperties}
                onClick={() => pick(p.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="ms-medal h-9 w-9" style={{ background: TIER_TONE[p.name] }} aria-hidden="true">
                      <i className="bi bi-gem text-[14px] text-white/90" />
                    </span>
                    <div>
                      <p className="font-display text-[20px] leading-tight font-semibold">{p.name}</p>
                      {p.highlighted && <span className="ms-badge">Most popular</span>}
                    </div>
                  </div>
                  <span className="ms-dot" aria-hidden="true" />
                </div>
                <p className="ms-sub mt-3 min-h-[42px] text-[13px] leading-[1.55]">{p.audience}</p>

                <div className="mt-4 flex items-baseline gap-1.5">
                  {typeof p.price === 'number' && p.price > 0 ? (
                    <>
                      <span className="ms-sub text-[13px] font-semibold">AED</span>
                      <span className="font-display text-[38px] leading-none font-semibold tracking-tight">
                        <CountUp value={p.price} run={mounted} delay={380 + i * 90} />
                      </span>
                      <span className="ms-sub text-[13px]">/ month</span>
                    </>
                  ) : (
                    <span className="font-display text-[19px] leading-[38px] font-semibold">Rate confirmed with you</span>
                  )}
                </div>

                {/* Metric bars */}
                <ul className="mt-5 space-y-3.5">
                  {metrics.map((m, mi) => {
                    const val = p[m.key] as number | null | undefined;
                    const max = Math.max(...plans.map((x) => Number(x[m.key]) || 0));
                    const pct = val == null ? 100 : max ? Math.max(6, (Number(val) / max) * 100) : 0;
                    return (
                      <li key={m.key}>
                        <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                          <span className="ms-sub">{m.label}</span>
                          <span className="font-semibold tabular-nums">
                            {val == null ? m.open : <CountUp value={Number(val)} run={mounted} delay={420 + i * 90 + mi * 60} />}
                          </span>
                        </div>
                        <div className="ms-bar mt-1.5">
                          <span
                            style={{
                              width: mounted ? `${pct}%` : 0,
                              transitionDelay: `${420 + i * 90 + mi * 60}ms`,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Incremental features */}
                <div className="ms-rule mt-5 pt-4">
                  <p className="ms-sub text-[11px] font-semibold tracking-[.12em] uppercase">
                    {prev ? `Everything in ${prev.name}, plus` : 'Includes'}
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {(extras.length ? extras : ['Higher limits across the board']).map((f, fi) => (
                      <li key={f} className="ms-feat flex items-start gap-2.5 text-[13px]" style={{ '--f': fi } as React.CSSProperties}>
                        <i className="bi bi-check2 ms-check mt-[1px]" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full comparison */}
        <Compare plans={plans} selected={selected} metrics={metrics} onPick={pick} />

        {/* Reassurance strip */}
        <ul className="ms-reveal mx-auto mt-14 grid max-w-[880px] gap-4 text-[13px] text-[#B9C4C1] sm:grid-cols-3">
          {[
            ['shield-check', 'Verified professionals only', 'Credentials are reviewed before your profile goes live.'],
            ['arrow-left-right', 'Switch tiers any time', 'Upgrade or downgrade from your workspace subscription page.'],
            ['lock', 'Secure billing', 'Payments run through Stripe. We never store card details.'],
          ].map(([icon, t, d]) => (
            <li key={t} className="ms-perk">
              <i className={`bi bi-${icon} text-[18px] text-sage`} aria-hidden="true" />
              <p className="mt-2 font-semibold text-white">{t}</p>
              <p className="mt-1 leading-[1.55]">{d}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Sticky action bar */}
      <div className="ms-bar-dock">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span key={current?.id} className="ms-medal ms-pop h-8 w-8 shrink-0" style={{ background: TIER_TONE[current?.name] }} aria-hidden="true" />
            <div className="min-w-0" aria-live="polite">
              <p className="truncate text-[14px] font-semibold text-white">
                {current?.name} <span className="font-normal text-white/60">· {audienceLabel} membership</span>
              </p>
              <p className="truncate text-[12px] text-white/55">
                {typeof current?.price === 'number' && current.price > 0
                  ? `AED ${current.price.toLocaleString()} / month · cancel any time`
                  : 'No payment now — our team confirms your rate'}
              </p>
            </div>
          </div>
          <button type="button" className="auth-press ms-cta btn btn-lg shrink-0" onClick={close}>
            Continue with {current?.name}
            <i className="bi bi-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ----------------------------------------------------------------------- */

function Compare({
  plans,
  selected,
  metrics,
  onPick,
}: {
  plans: PublicPlan[];
  selected: string;
  metrics: Metric[];
  onPick: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { root: el.closest('.ms-shell'), threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const features = [...new Set(plans.flatMap((p) => (p.features || []).filter((f) => !isQuantity(f))))];
  const col = plans.findIndex((p) => p.id === selected);

  return (
    <div ref={ref} className={cx('ms-compare mt-16 sm:mt-20', seen && 'is-seen')}>
      <h3 className="text-center font-display text-[22px] font-semibold text-white sm:text-[26px]">Compare every detail</h3>
      <div className="ms-scroll-x mt-6">
        <table className="ms-table" style={{ '--col': col } as React.CSSProperties}>
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                Feature
              </th>
              {plans.map((p) => (
                <th key={p.id} scope="col" className={cx(p.id === selected && 'is-on')}>
                  <button type="button" tabIndex={-1} onClick={() => onPick(p.id)} className="ms-th-btn">
                    <span className="ms-medal h-3 w-3" style={{ background: TIER_TONE[p.name] }} aria-hidden="true" />
                    {p.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, r) => (
              <tr key={m.key} style={{ '--r': r } as React.CSSProperties}>
                <th scope="row">{m.label}</th>
                {plans.map((p) => (
                  <td key={p.id} className={cx(p.id === selected && 'is-on')}>
                    {qty(p[m.key] as number | null, m.open)}
                  </td>
                ))}
              </tr>
            ))}
            {features.map((f, r) => (
              <tr key={f} style={{ '--r': metrics.length + r } as React.CSSProperties}>
                <th scope="row">{f}</th>
                {plans.map((p) => (
                  <td key={p.id} className={cx(p.id === selected && 'is-on')}>
                    {(p.features || []).includes(f) ? (
                      <i className="bi bi-check2 text-[16px] text-sage" aria-label="Included" />
                    ) : (
                      <span className="text-white/25" aria-label="Not included">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Counts from 0 to `value` once `run` turns true. */
function CountUp({ value, run, delay = 0, duration = 900 }: { value: number; run: boolean; delay?: number; duration?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    const still = reducedMotion();
    const dur = still ? 1 : duration;
    let raf = 0;
    const start = performance.now() + (still ? 0 : delay);
    const tick = (t: number) => {
      const k = still ? 1 : Math.min(1, Math.max(0, (t - start) / dur));
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, value, delay, duration]);
  return <>{n.toLocaleString()}</>;
}
