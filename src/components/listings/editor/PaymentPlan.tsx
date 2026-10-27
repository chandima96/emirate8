'use client';

import { Icon } from '@/components/ui/Icon';
import { fmtAED } from '@/lib/store';
import { uid } from '@/lib/utils';
import { GroupError, NumInput } from './inputs';
import { PLAN_COLORS, STAGES, planTotal, template } from './model';

const TEMPLATES = [
  ['60/40', '60/40'],
  ['50/50', '50/50'],
  ['post', 'With post-handover'],
];
const pctParse = (raw) => +String(raw).replace(/[^\d.]/g, '') || 0;

/** Off-plan payment plan: milestones (add / edit / reorder / remove), templates, bar and 100% total. */
export function PaymentPlan({ ed }) {
  const { L, set, confirm, errors } = ed;
  const pl = L.offplan.plan;
  const price = +L.price || 0;
  const total = planTotal(pl);
  const ok = total === 100;
  const setPlan = (next) => set('offplan.plan', next);
  const edit = (i, field, v) => setPlan(pl.map((m, j) => (j === i ? { ...m, [field]: v } : m)));
  const move = (i, d) => {
    const next = pl.slice();
    const j = i + d;
    [next[i], next[j]] = [next[j], next[i]];
    setPlan(next);
    setTimeout(() => {
      const target =
        document.querySelector(`[data-mmove="${j}:${d}"]:not(:disabled)`) ||
        document.querySelector(`[data-mmove="${j}:${-d}"]`);
      (target as HTMLElement)?.focus();
    }, 30);
  };
  const add = () => {
    setPlan([...pl, { id: uid('m'), label: '', stage: 'construction', pct: 0, due: '' }]);
    setTimeout(() => {
      const all = document.querySelectorAll('[data-mf="label"]');
      (all[all.length - 1] as HTMLElement)?.focus();
    }, 30);
  };
  const applyTemplate = async (key, label) => {
    if (pl.length) {
      const yes = await confirm({
        title: 'Replace the payment plan?',
        body: 'The current milestones will be replaced by the ' + label + ' template.',
        ok: 'Replace',
      });
      if (!yes) return;
    }
    setPlan(template(key));
  };

  return (
    <div className="mt-8 border-t border-line pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="h4">Payment plan</h3>
          <p className="mt-1 text-[13px] text-muted">
            Add each milestone from the developer’s schedule. The plan must total 100%.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Plan templates">
          {TEMPLATES.map(([key, label]) => (
            <button key={key} type="button" className="btn btn-ghost btn-sm" onClick={() => applyTemplate(key, label)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">
        {pl.map((m, i) => (
          <span key={m.id || i} style={{ width: Math.min(100, +m.pct || 0) + '%' }} className={PLAN_COLORS[i % 5]} />
        ))}
      </div>
      <ol className="mt-4 space-y-2">
        {pl.length ? (
          pl.map((m, i) => {
            const amount = price ? fmtAED((price * (+m.pct || 0)) / 100) : '';
            return (
              <li
                key={m.id || i}
                className="grid gap-2 rounded-lg border border-line bg-white p-3 sm:grid-cols-[28px_1.4fr_1fr_90px_1.2fr_auto] sm:items-center"
              >
                <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-mist text-xs font-semibold text-ink sm:flex">
                  {i + 1}
                </span>
                <div>
                  <label className="sr-only" htmlFor={'m-l-' + i}>
                    Milestone {i + 1} name
                  </label>
                  <input
                    id={'m-l-' + i}
                    className="input h-9 text-[13px]"
                    value={m.label || ''}
                    data-mf="label"
                    placeholder="Milestone"
                    onChange={(e) => edit(i, 'label', e.target.value)}
                  />
                </div>
                <div>
                  <label className="sr-only" htmlFor={'m-s-' + i}>
                    Stage
                  </label>
                  <select
                    id={'m-s-' + i}
                    className="select h-9 text-[13px]"
                    value={m.stage || 'construction'}
                    onChange={(e) => edit(i, 'stage', e.target.value)}
                  >
                    {STAGES.map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="calc-input">
                  <label className="sr-only" htmlFor={'m-p-' + i}>
                    Percentage
                  </label>
                  <NumInput
                    id={'m-p-' + i}
                    className="input h-9 pr-7 text-[13px]"
                    inputMode="decimal"
                    value={m.pct}
                    parse={pctParse}
                    onValue={(v) => edit(i, 'pct', v)}
                  />
                  <span>%</span>
                </div>
                <div>
                  <label className="sr-only" htmlFor={'m-d-' + i}>
                    When it is due
                  </label>
                  <input
                    id={'m-d-' + i}
                    className="input h-9 text-[13px]"
                    value={m.due || ''}
                    placeholder="When due"
                    onChange={(e) => edit(i, 'due', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between gap-1 sm:justify-end">
                  <span className="mr-2 text-xs text-muted tabular-nums sm:hidden">{amount}</span>
                  <span className="flex">
                    <button
                      type="button"
                      className="btn btn-ghost h-8 w-8 px-0"
                      data-mmove={i + ':-1'}
                      aria-label={'Move milestone ' + (i + 1) + ' up'}
                      disabled={!i}
                      onClick={() => move(i, -1)}
                    >
                      <Icon name="arrow-up" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost h-8 w-8 px-0"
                      data-mmove={i + ':1'}
                      aria-label={'Move milestone ' + (i + 1) + ' down'}
                      disabled={i >= pl.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <Icon name="arrow-down" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost h-8 w-8 px-0 text-danger"
                      aria-label={'Remove milestone ' + (i + 1)}
                      onClick={() => setPlan(pl.filter((_, j) => j !== i))}
                    >
                      <Icon name="trash3" />
                    </button>
                  </span>
                </div>
                {price > 0 && (
                  <p className="hidden text-right text-2xs text-muted tabular-nums sm:col-span-6 sm:block">{amount}</p>
                )}
              </li>
            );
          })
        ) : (
          <li className="rounded-lg border border-dashed border-line p-4 text-center text-[13px] text-muted">
            No milestones yet — add one or pick a template.
          </li>
        )}
      </ol>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn btn-outline btn-sm" onClick={add}>
          <Icon name="plus-lg" />
          Add milestone
        </button>
        <p className={'text-[13px] font-semibold ' + (ok ? 'text-ok' : 'text-danger')} aria-live="polite">
          <Icon name={ok ? 'check-circle-fill' : 'exclamation-circle'} className="mr-1 h-4 w-4" />
          Total {total}%{ok ? '' : ' — must equal 100%'}
        </p>
      </div>
      <GroupError id="err-plan" msg={errors.plan} />
    </div>
  );
}
