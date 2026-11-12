'use client';

import { useEffect, useState } from 'react';
import { Subscribers, PaymentsBilling } from './MembershipDirectory';
import { Icon } from '@/components/ui/Icon';
import type { AccountPlan } from '@/config/plans';

type EditablePlan = Omit<AccountPlan, 'price'> & { price: number | null };
const audiences = [
  {
    id: 'broker',
    name: 'Licensed Broker',
    description: 'For individual real estate professionals.',
    icon: 'person-check',
  },
  {
    id: 'agency',
    name: 'Real Estate Agency',
    description: 'For companies managing agents and property portfolios.',
    icon: 'building',
  },
  {
    id: 'developer',
    name: 'Property Developer',
    description: 'For developers publishing projects and inventory.',
    icon: 'buildings',
  },
];
async function request(action: string, values = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...values }),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error || 'Unable to save membership packages.');
  return body;
}

function MembershipPlans() {
  const [audience, setAudience] = useState('broker');
  const [plans, setPlans] = useState<EditablePlan[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  useEffect(() => {
    let active = true;
    request('membership-plans')
      .then((body) => {
        if (active) setPlans(body.plans);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const update = (id: string, patch: Partial<EditablePlan>) =>
    setPlans((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  return (
    <section className="mt-6 space-y-6">
      <div>
        <p className="eyebrow">Membership management</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">Plans and pricing</h2>
        <p className="mt-2 text-sm text-muted">
          Manage Bronze, Silver and Gold packages for each professional account type.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label="Account type">
        {audiences.map((item) => (
          <button
            type="button"
            key={item.id}
            role="radio"
            aria-checked={audience === item.id}
            onClick={() => setAudience(item.id)}
            className={`flex items-start gap-4 rounded-lg border bg-white p-5 text-left ${audience === item.id ? 'border-sage ring-1 ring-sage' : 'border-line'}`}
          >
            <span
              className={`mt-1 h-5 w-5 shrink-0 rounded-full border ${audience === item.id ? 'border-sage bg-sage' : 'border-line'}`}
            />
            <span className="flex-1">
              <span className="block font-semibold">{item.name}</span>
              <span className="mt-2 block text-sm text-muted">{item.description}</span>
            </span>
            <Icon name={item.icon} className="text-muted" />
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-sage/30 bg-sage/10 p-4 text-sm">
        <Icon name="shield-check" /> Existing members keep their agreed monthly price. Price changes apply to new
        registrations and members who choose a different plan.
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sage-deep text-sm">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading packages...</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-3">
          {plans
            .filter((item) => item.roleAudience === audience)
            .map((item) => (
              <form
                key={item.id}
                className="space-y-4 rounded-xl border border-line bg-white p-6"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSaving(item.id);
                  setError('');
                  setNotice('');
                  try {
                    await request('save-membership-plan', {
                      ...item,
                      slug: item.id,
                      features: item.features.join('\n'),
                    });
                    setNotice(`${item.name} saved. Existing members retain their agreed price.`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Unable to save.');
                  } finally {
                    setSaving('');
                  }
                }}
              >
                <h3 className="font-display text-xl font-semibold">{item.name}</h3>
                <label className="block text-sm">
                  Monthly price (AED)
                  <input
                    className="input mt-2"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="To be confirmed"
                    value={item.price ?? ''}
                    onChange={(e) => update(item.id, { price: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </label>
                <label className="block text-sm">
                  Description
                  <input
                    className="input mt-2"
                    value={item.audience}
                    onChange={(e) => update(item.id, { audience: e.target.value })}
                  />
                </label>
                {(['seats', 'listings', 'selections'] as const).map((key) => (
                  <label className="block text-sm capitalize" key={key}>
                    {key}
                    <input
                      className="input mt-2"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Unlimited"
                      value={item[key] ?? ''}
                      onChange={(e) =>
                        update(item.id, { [key]: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
                <p className="text-xs text-muted">Leave a limit blank for a flexible allowance.</p>
                <label className="block text-sm">
                  Features (one per line)
                  <textarea
                    className="input mt-2 min-h-36"
                    value={item.features.join('\n')}
                    onChange={(e) => update(item.id, { features: e.target.value.split('\n') })}
                  />
                </label>
                <button disabled={Boolean(saving)} className="btn btn-dark w-full">
                  {saving === item.id ? 'Saving...' : `Save ${item.name}`}
                </button>
              </form>
            ))}
        </div>
      )}
    </section>
  );
}

export function MembershipManagement() {
  const [step, setStep] = useState('plans');
  return (
    <div className="mt-6 space-y-6">
      <nav className="flex flex-wrap gap-2" aria-label="Membership management sections">
        {(
          [
            ['plans', '1. Plans & pricing', 'gem'],
            ['subscribers', '2. Subscribers', 'people'],
            ['billing', '3. Payments & billing', 'credit-card'],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            aria-current={step === id ? 'page' : undefined}
            className={`btn btn-sm ${step === id ? 'btn-dark' : 'btn-outline bg-white'}`}
            onClick={() => setStep(id)}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
      {step === 'plans' && <MembershipPlans />}
      {step === 'subscribers' && <Subscribers />}
      {step === 'billing' && <PaymentsBilling />}
    </div>
  );
}
