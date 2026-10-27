'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PropertyCard } from '@/components/property/PropertyCard';
import { SelectButton, useSelectToggle } from './network/NetworkBits';
import { useStoreVersion } from '@/hooks/useStore';

async function loadDeveloperNetwork() {
  const response = await fetch('/api/role-workspace?developerNetwork=1', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load the developer network.');
  return response.json();
}

function developerLogo(developer) {
  const profileLogo = developer.profile?.developer?.logo;
  const registrationLogo = developer.profile?.credentials?.developerLogo;
  const src = typeof profileLogo === 'string' && profileLogo ? profileLogo : registrationLogo?.url;
  if (src) return { src, initials: '' };
  const name = developer.profile?.developer?.displayName || developer.name || 'Developer';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return { src: '', initials };
}

function DeveloperLogo({ developer }) {
  const logo = developerLogo(developer);
  if (logo.src) return <img src={logo.src} alt="" className="h-12 w-12 rounded-2xl border border-line bg-white object-contain p-2 shadow-sm" />;
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-sage/30 bg-sage-soft text-sage-ink shadow-sm" aria-label="Default developer logo">
      <Icon name="buildings" className="h-5 w-5" />
      <span className="mt-0.5 text-[9px] font-bold tracking-[.08em]">{logo.initials}</span>
    </div>
  );
}

export function DeveloperNetwork() {
  useStoreVersion();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const toggle = useSelectToggle();

  const load = () => loadDeveloperNetwork().then(setData).catch((error) => setMessage(error.message));
  useEffect(() => {
    void load();
  }, []);

  const updateSubscription = async (developerId, subscribed) => {
    setBusy(String(developerId));
    setMessage('');
    try {
      const response = await fetch('/api/role-workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: subscribed ? 'unsubscribe-developer' : 'subscribe-developer', developerId }),
      });
      const result = await response.json();
      if (!response.ok) return setMessage(result.error || 'Could not subscribe.');
      setMessage(subscribed ? 'Developer unsubscribed.' : 'Developer subscription updated.');
      await load();
    } finally {
      setBusy('');
    }
  };

  const active = useMemo(
    () => new Set((data?.subscriptions || []).filter((item) => item.status === 'active').map((item) => String(item.developer?.id || item.developer))),
    [data],
  );
  const properties = data?.developerProperties || [];
  if (!data || !['broker', 'agency'].includes(data.role)) return null;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Professional network</p>
          <h1 className="h2 mt-2">Developers Network</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Follow available developers and receive notifications when their published property inventory changes.
          </p>
        </div>
        <Icon name="building" className="h-8 w-8 text-sage-ink" />
      </div>

      <section className="mt-6 card p-5 sm:p-6" aria-labelledby="developer-network-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="developer-network-title" className="h3">Available developers</h2>
            <p className="mt-1 text-sm text-muted">Subscribe once to keep developer launches and updates in your notification feed.</p>
          </div>
          <span className="badge badge-muted">{active.size} subscribed</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(data.developers || []).map((developer) => {
            const developerProperties = properties.filter((property) => String(property.developerId) === String(developer.id));
            const subscribed = active.has(String(developer.id));
            return (
              <article className="group flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sage hover:shadow-card" key={developer.id}>
                <div className="flex flex-col gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <DeveloperLogo developer={developer} />
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-display text-[15px] font-semibold leading-tight text-ink">{developer.profile?.developer?.displayName || developer.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {developerProperties.length} published {developerProperties.length === 1 ? 'property' : 'properties'}
                    </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={subscribed ? 'btn btn-outline btn-sm w-full border-sage text-sage-ink' : 'btn btn-dark btn-sm w-full'}
                    disabled={busy === String(developer.id)}
                    onClick={() => void updateSubscription(developer.id, subscribed)}
                  >
                    {subscribed && <Icon name="check-lg" />}
                    {busy === String(developer.id) ? 'Saving…' : subscribed ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {!(data.developers || []).length && <p className="mt-5 text-sm text-muted">No developers are available yet.</p>}
        {message && <p className="mt-4 text-sm text-muted" role="status">{message}</p>}
      </section>

      <section className="mt-8" aria-labelledby="developer-properties-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Property opportunities</p>
            <h2 id="developer-properties-title" className="h3 mt-2">Developer properties</h2>
            <p className="mt-1 text-sm text-muted">
              Browse published developer inventory in the same property-card view as the Broker Network.
            </p>
          </div>
          <span className="badge badge-muted">{properties.length} published</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <div className="card overflow-hidden" key={property.id}>
              <PropertyCard listing={property} tag={property.developerName} className="rounded-none border-0 shadow-none" />
              <div className="border-t border-line p-3">
                <SelectButton n={property} small onToggle={toggle} />
              </div>
            </div>
          ))}
          {!properties.length && (
            <div className="col-span-full rounded-lg border border-dashed border-line bg-white p-10 text-center">
              <Icon name="buildings" className="mx-auto h-6 w-6 text-muted" />
              <p className="mt-3 font-display text-[16px] font-semibold text-ink">No published developer properties yet</p>
              <p className="mt-1 text-[13px] text-muted">Subscribed developers will appear here when they publish visible inventory.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** Backwards-compatible name for existing dashboard usage. */
export function DeveloperSubscriptions() {
  return <DeveloperNetwork />;
}
