'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { counts, currentUser, fmtDate, fmtNumber, log, plan, plans, saveUser } from '@/lib/store';
import { trialLeft } from './shared';

const Check = () => <Icon name="check-lg" className="h-4 w-4" />;
/** Plan, usage and demo billing (old subscription.html + dashboard.js subscription part). */
export function Subscription() {
  useStoreVersion();
  const { toast, confirm } = useFeedback();
  const [payOpen, setPayOpen] = useState(false);
  const user = currentUser();
  const p = plan(user);
  const roleAudience = user?.type === 'owner' ? 'developer' : user?.type || 'broker';
  const availablePlans = Object.values(plans()).filter((item) => item.roleAudience === roleAudience);
  const c = counts(user);
  const usage = [
    ['Published listings', c.published, p.listings],
    ['Selected properties', c.selected, p.selections],
    ['User seats', 1, p.seats],
  ];

  const switchTo = async (id) => {
    const np = plans()[id];
    if (!np || np.roleAudience !== roleAudience) return;
    const now = counts();
    if (np.selections && now.selected > np.selections) {
      toast('Remove some selected properties first — ' + np.name + ' allows ' + np.selections + '.', {
        icon: 'exclamation-circle',
      });
      return;
    }
    if (np.listings && now.published > np.listings) {
      toast('Unpublish some listings first — ' + np.name + ' allows ' + np.listings + ' active.', {
        icon: 'exclamation-circle',
      });
      return;
    }
    const ok = await confirm({
      title: 'Switch to ' + np.name + '?',
      body:
        'Your demo trial continues on the ' +
        np.name +
        ' plan. Pricing is still to be confirmed and nothing is charged.',
      ok: 'Switch plan',
    });
    if (!ok) return;
    const u = currentUser();
    u.plan = id;
    u.cancelled = false;
    saveUser(u);
    log('Switched plan to ' + np.name, 'gem');
    toast('You’re now on ' + np.name + ' (trial).');
  };

  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel your trial?',
      body: 'You keep access until the trial ends. In this demo, nothing is charged either way.',
      ok: 'Cancel trial',
      danger: true,
    });
    if (!ok) return;
    const u = currentUser();
    u.cancelled = true;
    saveUser(u);
    log('Cancelled trial', 'x-circle');
    toast('Trial cancelled — access continues until it ends.');
  };

  const featureNames = [...new Set(availablePlans.flatMap((item) => item.features || []))];
  const comparisonRows = [
    { label: 'Best for', values: availablePlans.map((item) => item.audience || roleAudience) },
    { label: 'User seats', values: availablePlans.map((item) => item.seats == null ? 'Flexible' : fmtNumber(item.seats)) },
    { label: 'Active listings', values: availablePlans.map((item) => item.listings == null ? 'Flexible' : fmtNumber(item.listings)) },
    { label: 'Network selections', values: availablePlans.map((item) => item.selections == null ? 'Flexible' : fmtNumber(item.selections)) },
    ...featureNames.map((feature) => ({ label: feature, values: availablePlans.map((item) => (item.features || []).includes(feature)) })),
    { label: 'Price', values: availablePlans.map(() => 'To be confirmed') },
  ];

  return (
    <div className="mx-auto max-w-[1100px]">
      <div>
        <h1 className="h2 text-[24px] lg:text-[28px]">Subscription &amp; Billing</h1>
        <p className="mt-1 text-[14px] text-muted">Your plan, usage and billing details.</p>
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-xs leading-[1.55] text-warn">
        <Icon name="info-circle" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          <span className="font-semibold">Billing is not enabled.</span> Plan prices are still to be confirmed and no
          payments are processed. Plan changes are saved to your account.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="on-dark rounded-lg bg-ink p-5 sm:p-6 lg:col-span-1" aria-labelledby="cp-title">
          <p className="text-2xs font-semibold tracking-[.12em] text-sage uppercase">Current plan</p>
          <h2 id="cp-title" className="mt-3 font-display text-[26px] font-semibold text-white">
            {p.name}{' '}
            <em className="f text-[22px] font-normal text-sage">
              {user.trial ? 'trial' : user.cancelled ? 'cancelled' : ''}
            </em>
          </h2>
          <p className="mt-1 text-[13px] text-[#A9B4B1]">{p.audience}</p>
          <dl className="mt-5 space-y-2 border-t border-white/15 pt-4 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[#A9B4B1]">Price</dt>
              <dd className="text-white">To be confirmed</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#A9B4B1]">Trial ends</dt>
              <dd className="text-white">
                {user.trial ? fmtDate(user.trialEnds) + ' (' + trialLeft(user) + ' days)' : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#A9B4B1]">Status</dt>
              <dd className="text-white">{user.cancelled ? 'Ends with trial' : user.trial ? 'Trialing' : 'Active'}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#compare" className="btn btn-sage btn-sm">
              Change plan
            </a>
            {user.trial && !user.cancelled && (
              <button type="button" className="btn btn-outline-light btn-sm" onClick={cancel}>
                Cancel trial
              </button>
            )}
          </div>
        </section>

        <section className="card p-5 sm:p-6 lg:col-span-2" aria-labelledby="us-title">
          <h2 id="us-title" className="h4">
            Usage
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {usage.map(([label, used, limit]) => (
              <div key={label}>
                <div className="flex items-end justify-between">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-xs font-semibold text-ink">
                    {used} / {limit ? fmtNumber(limit) : 'Flexible'}
                  </p>
                </div>
                <div className="meter mt-2">
                  <span style={{ width: (limit ? Math.min(100, (used / limit) * 100) : 4) + '%' }} />
                </div>
                <p className="mt-1.5 text-2xs text-muted">
                  {limit ? fmtNumber(Math.max(0, limit - used)) + ' remaining' : 'Configured with your account manager'}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
            Limits are provisional until confirmed by Emirate08. Selected properties that become unavailable still use a
            slot until you remove them.
          </p>
        </section>
      </div>

      <section id="compare" className="mt-8 scroll-mt-24" aria-labelledby="cmp-title">
        <h2 id="cmp-title" className="h3">
          Plan comparison
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="table min-w-[620px]">
            <thead>
              <tr>
                <th className="w-[34%]">Feature</th>
                {availablePlans.map((item) => <th key={item.id}>{item.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <td className="text-muted">{row.label}</td>
                  {row.values.map((value, index) => (
                    <td key={index}>{value === true ? <Check /> : value === false ? '—' : value}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td />
                {availablePlans.map((item) => (
                  <td key={item.id}>
                    {item.id === p.id ? (
                      <span className="badge badge-dark">Current plan</span>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => switchTo(item.id)}>
                        Switch to {item.name}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6" aria-labelledby="bh-title">
          <h2 id="bh-title" className="h4">
            Billing history
          </h2>
          <div className="mt-4 rounded-lg border border-dashed border-line p-8 text-center">
            <Icon name="receipt" className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-2 text-[13px] font-semibold text-ink">No invoices yet</p>
            <p className="mt-1 text-xs text-muted">
              Invoices will appear here once paid billing begins after your trial.
            </p>
          </div>
        </section>
        <section className="card p-5 sm:p-6" aria-labelledby="pm-title">
          <h2 id="pm-title" className="h4">
            Payment method
          </h2>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-line p-4">
            <span className="flex h-10 w-14 items-center justify-center rounded bg-mist">
              <Icon name="credit-card" className="h-5 w-5 text-muted" />
            </span>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-ink">No payment method on file</p>
              <p className="text-xs text-muted">Not required during the trial.</p>
            </div>
          </div>
          <button type="button" className="btn btn-outline mt-4" onClick={() => setPayOpen(true)}>
            <Icon name="plus-lg" />
            Add payment method
          </button>
        </section>
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} labelledBy="pay-title" panelClassName="p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mist">
          <Icon name="lock" className="h-5 w-5 text-ink" />
        </span>
        <h2 id="pay-title" className="h4 mt-4">
          Payments are not enabled
        </h2>
        <p className="mt-2 text-[13px] leading-[1.6] text-muted">
          Card details are not collected. Payments will be handled by a secure provider once plan pricing is confirmed.
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn btn-dark" onClick={() => setPayOpen(false)}>
            Understood
          </button>
        </div>
      </Modal>
    </div>
  );
}
