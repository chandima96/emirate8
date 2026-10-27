'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/providers/SessionProvider';
import { Icon } from '@/components/ui/Icon';
import { PropertyCard } from '@/components/property/PropertyCard';
import { notificationPropertyHref } from '@/lib/notificationLinks';
import { useRouter } from 'next/navigation';

async function loadWorkspace(query = '') {
  const response = await fetch(`/api/role-workspace${query}`, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load workspace data.');
  return response.json();
}

export function DeveloperDashboard() {
  const { user } = useSession();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const load = () =>
    loadWorkspace('?developerDashboard=1')
      .then(setData)
      .catch((error) => setMessage(error.message));
  useEffect(() => void load(), []);
  const decide = async (claimId, decision) => {
    const response = await fetch('/api/role-workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'decide-claim', claimId, decision }),
    });
    if (response.ok) load();
  };
  const properties = data?.properties || [];
  const claims = data?.claims || [];
  return (
    <div className="mx-auto max-w-[1240px] space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Developer workspace</p>
          <h1 className="h2 mt-2">Manage your property pipeline.</h1>
          <p className="mt-2 text-sm text-muted">
            {user?.name || 'Developer'} · publish inventory and approve broker representation.
          </p>
        </div>
        <Link href="/account" className="btn btn-outline">
          <Icon name="gear" /> Account
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['Properties', properties.length, 'buildings'],
          ['Pending claims', claims.filter((claim) => claim.status === 'pending').length, 'people'],
        ].map(([label, value, icon]) => (
          <div className="kpi" key={label}>
            <div className="flex justify-between text-xs text-muted">
              {label}
              <Icon name={icon} className="h-4 w-4" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <section className="card p-5 sm:p-6">
          <p className="eyebrow">Unified property flow</p>
          <h2 className="h3 mt-2">Add a property</h2>
          <p className="mt-1 text-sm text-muted">
            Use the same full editor as brokers and agencies. During the permit and display step, choose a primary
            broker or publish publicly so approved brokers can request representation.
          </p>
          <Link href="/listings/new" className="btn btn-dark mt-5">
            <Icon name="plus-lg" />
            Add Property
          </Link>
          {message && <p className="mt-3 text-sm text-muted">{message}</p>}
      </section>
      <section>
        <div className="flex items-center justify-between">
          <h2 className="h3">Broker claim requests</h2>
        </div>
        <div className="mt-4 space-y-3">
          {claims
            .filter((claim) => claim.status === 'pending')
            .map((claim) => (
              <div className="card flex flex-wrap items-center justify-between gap-3 p-4" key={claim.id}>
                <div>
                  <p className="font-semibold">{claim.brokerMember?.name || 'Broker request'}</p>
                  <p className="text-sm text-muted">{claim.property?.title || 'Property'} · pending approval</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-dark btn-sm" onClick={() => decide(claim.id, 'approved')}>
                    Approve
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => decide(claim.id, 'rejected')}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          {!claims.some((claim) => claim.status === 'pending') && (
            <p className="text-sm text-muted">No pending claim requests.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function AgencyDashboard() {
  const { user } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const members = data?.team || [];
  const [form, setForm] = useState({ name: '', email: '', role: 'agency_broker' });
  const [brokerSearch, setBrokerSearch] = useState('');
  const [brokerMatches, setBrokerMatches] = useState([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    loadWorkspace('?agencyDashboard=1')
      .then(setData)
      .catch(() => setMessage('Could not load agency dashboard data.'))
      .finally(() => setLoading(false));
  }, []);
  const load = () =>
    loadWorkspace('?agencyDashboard=1')
      .then(setData)
      .catch((error) => setMessage(error.message));
  const invite = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/role-workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'invite-team', ...form }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || 'Could not create invitation.');
    setForm({ name: '', email: '', role: 'agency_broker' });
    setMessage(result.linkedExistingBroker ? 'Invitation email sent to the broker.' : 'Invitation email sent with a temporary password.');
    load();
  };
  const inviteBroker = async (broker) => {
    const response = await fetch('/api/role-workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'invite-team', name: broker.name, email: broker.email, role: 'agency_broker' }) });
    const result = await response.json();
    setMessage(response.ok ? 'Invitation email sent to the broker.' : (result.error || 'Could not invite this broker.'));
    setBrokerMatches((current) => current.filter((item) => item.id !== broker.id));
    if (response.ok) load();
  };
  const cancel = async (id) => {
    await fetch('/api/role-workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cancel-team-invite', id }),
    });
    load();
  };
  const invitations = (data?.invitations || []).filter((item) => item.status === 'pending');
  return (
    <div className="mx-auto max-w-[1240px] space-y-8">
      <div>
        <p className="eyebrow">Agency workspace</p>
        <h1 className="h2 mt-2">Coordinate your team.</h1>
        <Link href="/agency-team" className="btn btn-dark mt-4"><Icon name="people" /> Open team page <Icon name="arrow-right" /></Link>
        <p className="mt-2 text-sm text-muted">{user?.name || 'Agency'} · team, listings and enquiries in one place.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kpi">
          <p className="text-xs text-muted">Properties</p>
          {loading ? <div className="mt-3 h-9 w-14 animate-pulse rounded bg-line/60" aria-hidden="true" /> : <p className="mt-3 font-display text-3xl font-semibold">{data?.properties?.length || 0}</p>}
        </div>
        <div className="kpi">
          <p className="text-xs text-muted">Team members</p>
          {loading ? <div className="mt-3 h-9 w-14 animate-pulse rounded bg-line/60" aria-hidden="true" /> : <p className="mt-3 font-display text-3xl font-semibold">{members.length}</p>}
        </div>
        <div className="kpi">
          <p className="text-xs text-muted">Notifications</p>
          {loading ? <div className="mt-3 h-9 w-14 animate-pulse rounded bg-line/60" aria-hidden="true" /> : <p className="mt-3 font-display text-3xl font-semibold">
            {data?.notifications?.filter((item) => !item.read).length || 0}
          </p>}
        </div>
      </div>
      {false && <section id="team" className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="h3">Team</h2>
            <p className="mt-1 text-sm text-muted">
              Agency team management is separated from the individual broker portfolio.
            </p>
          </div>
          <Link href="/account" className="btn btn-outline btn-sm">
            Manage agency profile
          </Link>
        </div>
        <div className="mt-5">
          <label className="label" htmlFor="team-broker-search">Find an independent broker</label>
          <input id="team-broker-search" className="input" placeholder="Search broker name" value={brokerSearch} onChange={async (event) => {
            const value = event.target.value; setBrokerSearch(value);
            if (value.trim().length < 2) return setBrokerMatches([]);
            const response = await fetch(`/api/role-workspace?teamSearch=${encodeURIComponent(value)}`, { credentials: 'same-origin', cache: 'no-store' });
            const result = response.ok ? await response.json() : {};
            setBrokerMatches(result.brokerSearch || []);
          }} />
          {brokerMatches.length > 0 && <div className="mt-2 space-y-2">{brokerMatches.map((broker) => <div key={broker.id} className="flex items-center justify-between rounded-lg border border-line p-3"><div><p className="font-semibold">{broker.name}</p><p className="text-xs text-muted">{broker.email}</p></div><button className="btn btn-outline btn-sm" onClick={() => inviteBroker(broker)}>Invite broker</button></div>)}</div>}
        </div>
        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_180px_auto]" onSubmit={invite}>
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="agency_broker">Broker</option>
            <option value="agency_manager">Manager</option>
            <option value="agency_viewer">Viewer</option>
          </select>
          <button className="btn btn-dark">Invite</button>
        </form>
        {message && <p className="mt-3 text-sm text-muted">{message}</p>}
        <div className="mt-5 grid gap-2">
          {members.map((item) => (
            <div className="flex items-center justify-between rounded-lg border border-line p-3" key={item.id}>
              <div><p className="font-semibold">{item.name}</p><p className="text-xs text-muted">{item.email}</p></div>
              <span className="badge badge-muted">{item.agencyRole.replace('agency_', '')}</span>
            </div>
          ))}
          {invitations.map((item) => (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-line p-3" key={item.id}>
              <div><p className="font-semibold">{item.name || item.email}</p><p className="text-xs text-muted">Pending invitation Â· {item.email}</p></div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => cancel(item.id)}>Cancel</button>
            </div>
          ))}
          {!members.length && !invitations.length && <p className="text-sm text-muted">No team members yet.</p>}
        </div>
      </section>}
      <section>
        <h2 className="h3">Recent properties</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
          {loading
            ? Array.from({ length: 3 }, (_, index) => (
                <div className="card overflow-hidden" key={`property-skeleton-${index}`} aria-hidden="true">
                  <div className="aspect-[4/3] animate-pulse bg-line/60" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-1/2 animate-pulse rounded bg-line/60" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-line/60" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-line/60" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-line/60" />
                  </div>
                </div>
              ))
            : (data?.properties || []).slice(0, 6).map((property) => (
                <PropertyCard listing={property} agent={false} key={property.id} />
              ))}
          {!loading && !(data?.properties || []).length && <p className="text-sm text-muted">No properties yet.</p>}
        </div>
      </section>
    </div>
  );
}

export function AgencyTeamDashboard() {
  const { user } = useSession();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'agency_broker' });
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const brokerSearchRequest = useRef(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const members = data?.team || [];
  const invitations = (data?.invitations || []).filter((item: any) => item.status === 'pending');
  const load = () => loadWorkspace('?agencyTeam=1').then(setData).catch((error) => setMessage(error.message));
  useEffect(() => { void load(); }, []);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage('');
    const response = await fetch('/api/role-workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'invite-team', ...form }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(result.error || 'Could not create invitation.');
    setForm({ name: '', email: '', role: 'agency_broker' });
    setMessage(result.linkedExistingBroker ? 'Invitation email sent to the broker.' : 'Invitation email sent with a temporary password.');
    await load();
  };

  const searchBrokers = async (value: string) => {
    setSearch(value);
    const requestId = ++brokerSearchRequest.current;
    if (value.trim().length < 2) { setMatches([]); setSearching(false); return; }
    setSearching(true);
    try {
      const response = await fetch(`/api/role-workspace?teamSearch=${encodeURIComponent(value.trim())}`, { credentials: 'same-origin', cache: 'no-store' });
      const result = response.ok ? await response.json() : {};
      if (requestId === brokerSearchRequest.current) setMatches(result.brokerSearch || []);
    } catch {
      if (requestId === brokerSearchRequest.current) setMatches([]);
    } finally {
      if (requestId === brokerSearchRequest.current) setSearching(false);
    }
  };

  const inviteBroker = async (broker: any) => {
    setBusy(true); setMessage('');
    const response = await fetch('/api/role-workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'invite-team', name: broker.name, email: broker.email, role: 'agency_broker' }) });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? 'Invitation email sent to the broker.' : (result.error || 'Could not invite this broker.'));
    setMatches((current) => current.filter((item) => item.id !== broker.id));
    if (response.ok) await load();
  };

  const cancel = async (id: string | number) => {
    const response = await fetch('/api/role-workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'cancel-team-invite', id }) });
    if (!response.ok) setMessage('Could not cancel this invitation.');
    await load();
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Agency workspace</p><h1 className="h2 mt-2">Team management</h1><p className="mt-2 max-w-2xl text-sm text-muted">Invite colleagues, find independent brokers, and keep track of your agency roster.</p></div>
        <Link href="/agency-dashboard" className="btn btn-outline"><Icon name="arrow-left" /> Agency dashboard</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kpi"><p className="text-xs text-muted">Team members</p><p className="mt-3 font-display text-3xl font-semibold">{members.length}</p></div>
        <div className="kpi"><p className="text-xs text-muted">Pending invitations</p><p className="mt-3 font-display text-3xl font-semibold">{invitations.length}</p></div>
        <div className="kpi"><p className="text-xs text-muted">Agency account</p><p className="mt-3 truncate font-display text-xl font-semibold">{user?.name || 'Agency'}</p></div>
      </div>

      <section className="card p-5 sm:p-6">
        <p className="eyebrow">Invite by email</p><h2 className="h3 mt-2">Add a team member</h2>
        <p className="mt-1 text-sm text-muted">New team members receive sign-in details by email and set their password on first sign-in.</p>
        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_180px_auto]" onSubmit={invite}>
          <input className="input" placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input className="input" type="email" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <select className="select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="agency_broker">Broker</option><option value="agency_manager">Manager</option><option value="agency_viewer">Viewer</option></select>
          <button className="btn btn-dark" disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</button>
        </form>
        {message && <p className="mt-3 text-sm text-muted" role="status">{message}</p>}
      </section>

      <section className="card p-5 sm:p-6">
        <p className="eyebrow">Broker network</p><h2 className="h3 mt-2">Find an independent broker</h2>
        <p className="mt-1 text-sm text-muted">Search registered brokers by name and invite them to join the agency.</p>
        <input className="input mt-5 max-w-xl" aria-label="Search brokers by name" placeholder="Search broker name" value={search} onChange={(event) => void searchBrokers(event.target.value)} />
        {searching && <p className="mt-3 text-sm text-muted" role="status">Searching brokers…</p>}
        {!searching && search.trim().length >= 2 && matches.length === 0 && <p className="mt-3 text-sm text-muted">No independent brokers found for that name.</p>}
        <div className="mt-3 space-y-2">{matches.map((broker) => <div key={broker.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"><div><p className="font-semibold">{broker.name}</p><p className="text-xs text-muted">{broker.email}</p></div><button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void inviteBroker(broker)}>Invite broker</button></div>)}</div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Agency roster</p><h2 className="h3 mt-2">Members and invitations</h2></div><Link href="/account" className="btn btn-outline btn-sm">Agency profile</Link></div>
        <div className="mt-5 space-y-2">
          {members.map((item: any) => <div key={`member-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-muted">{item.email}</p></div><span className="badge badge-muted capitalize">{String(item.agencyRole || 'agency_broker').replace('agency_', '')}</span></div>)}
          {invitations.map((item: any) => <div key={`invite-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line p-3"><div><p className="font-semibold">{item.name || item.email}</p><p className="text-xs text-muted">Pending invitation · {item.email}</p></div><div className="flex items-center gap-2"><span className="badge badge-muted capitalize">{String(item.role || 'agency_broker').replace('agency_', '')}</span><button type="button" className="btn btn-outline btn-sm" onClick={() => void cancel(item.id)}>Cancel</button></div></div>)}
          {!members.length && !invitations.length && <p className="text-sm text-muted">No team members or pending invitations yet.</p>}
        </div>
      </section>
    </div>
  );
}

export function NotificationsCenter() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch('/api/role-workspace?notifications=1', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { notifications: [] }))
      .then((data) => setItems(data.notifications || []));
  }, []);
  const read = async (id) => {
    await fetch('/api/role-workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark-notification-read', id }),
    });
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };
  const openNotification = async (item) => {
    if (!item.read) await read(item.id);
    const href = notificationPropertyHref(item);
    if (href) router.push(href);
  };
  return (
    <div className="mx-auto max-w-[900px]">
      <p className="eyebrow">Workspace</p>
      <h1 className="h2 mt-2">Notifications</h1>
      <ul className="mt-6 divide-y divide-line rounded-lg border border-line bg-white">
        {items.map((item) => (
          <li className="flex items-start justify-between gap-4 p-4" key={item.id}>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openNotification(item)}>
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.message}</p>
            </button>
            {!item.read && (
              <button className="btn btn-outline btn-sm" onClick={() => read(item.id)}>
                Mark read
              </button>
            )}
          </li>
        ))}
        {!items.length && <li className="p-5 text-sm text-muted">No notifications yet.</li>}
      </ul>
    </div>
  );
}
