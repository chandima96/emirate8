import { fmtAED } from '@/lib/store';

const TONES = ['bg-ink', 'bg-ink-2', 'bg-sage-ink', 'bg-sage', 'bg-line'];

/** 04c — off-plan payment plan as provided by the developer (milestone bar + list). */
export function PaymentPlan({ listing: l }) {
  const plan = (l.completion === 'offplan' && l.offplan?.plan) || [];
  if (!plan.length) return null;
  const total = plan.reduce((s, m) => s + (+m.pct || 0), 0);
  return (
    <section className="mt-8" aria-labelledby="h-plan">
      <h2 id="h-plan" className="h3">
        Payment plan
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        As provided by the developer for this unit. Amounts are calculated on the listed price.
      </p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-mist" aria-hidden="true">
        {plan.map((m, i) => (
          <span key={i} style={{ width: `${+m.pct || 0}%` }} className={TONES[i % 5]} />
        ))}
      </div>
      <ol className="mt-4 divide-y divide-line rounded-lg border border-line bg-white">
        {plan.map((m, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-semibold text-ink">
                {i + 1}
              </span>
              <div>
                <p className="text-[14px] font-semibold text-ink">{m.label}</p>
                <p className="text-xs text-muted">{m.due || ''}</p>
              </div>
            </div>
            <p className="shrink-0 text-right">
              <span className="font-display text-[16px] font-semibold text-ink">{+m.pct || 0}%</span>
              <span className="block text-xs text-muted">
                {l.price ? fmtAED((l.price * (+m.pct || 0)) / 100) : '—'}
              </span>
            </p>
          </li>
        ))}
      </ol>
      {Math.round(total) !== 100 && <p className="mt-2 text-xs text-danger">The milestones add up to {total}%.</p>}
    </section>
  );
}
