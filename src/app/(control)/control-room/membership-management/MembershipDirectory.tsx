'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { csvText, memberTypes, money, monthlySummary, statuses, type Subscriber, type Payment } from '@/lib/membership';

export async function membershipRequest(action: string, values = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...values }),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error || 'The membership request failed.');
  return body;
}
function download(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${['active', 'paid'].includes(value) ? 'bg-emerald-50 text-emerald-600' : ['pending'].includes(value) ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}
    >
      {statuses[value] || value}
    </span>
  );
}
const dateText = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    timeZone: 'Asia/Colombo',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
const th = 'px-5 py-4 text-xs font-semibold tracking-wider text-muted uppercase';
const td = 'px-5 py-5 text-sm';

export function Subscribers() {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [nextStatus, setNextStatus] = useState('pending');
  const [busy, setBusy] = useState(false);
  async function load() {
    const body = await membershipRequest('membership-subscribers');
    setItems(body.subscribers);
  }
  useEffect(() => {
    let active = true;
    membershipRequest('membership-subscribers')
      .then((body) => {
        if (active) setItems(body.subscribers);
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
  const filtered = items.filter(
    (item) =>
      (!status || item.status === status) &&
      (!type || item.accountType === type) &&
      `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase().trim()),
  );
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-emerald-600">Member directory</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">Subscribers</h2>
          <p className="mt-2 text-sm text-muted">Manage memberships across every account type.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline bg-white"
          disabled={loading || !filtered.length}
          onClick={() =>
            download('subscribers.csv', [
              ['Subscriber', 'Email', 'Member type', 'Plan', 'Status', 'Monthly price (AED)', 'Joined'],
              ...filtered.map((item) => [
                item.name,
                item.email,
                memberTypes[item.accountType],
                item.planName,
                statuses[item.status],
                item.price,
                item.createdAt,
              ]),
            ])
          }
        >
          <Icon name="download" /> Export CSV
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-700 text-sm">
          {notice}
        </p>
      )}
      <div className="rounded-2xl border border-line bg-white p-4 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <label className="relative w-full sm:max-w-md">
            <span className="sr-only">Search subscribers</span>
            <input
              className="input"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="input w-auto"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {['active', 'pending', 'past_due', 'suspended', 'cancelled'].map((value) => (
              <option key={value} value={value}>
                {statuses[value]}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            aria-label="Filter by member type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All member types</option>
            {Object.entries(memberTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-slate-50/60 border-b border-line">
              <tr>
                {['Subscriber', 'Member type', 'Plan', 'Status', 'Monthly price', 'Actions'].map((label) => (
                  <th key={label} className={th}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-50 text-blue-500 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-semibold">
                        {item.name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')}
                      </span>
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 text-xs text-muted">{item.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={td}>{memberTypes[item.accountType]}</td>
                  <td className={td}>{item.planName}</td>
                  <td className={td}>
                    <Status value={item.status} />
                  </td>
                  <td className={td}>{money(item.price)}</td>
                  <td className={td}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setSelected(item);
                        setNextStatus(item.status);
                        setError('');
                        setNotice('');
                      }}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-sm text-muted">
                    {loading
                      ? 'Loading subscribers...'
                      : items.length
                        ? 'No subscribers match your filters.'
                        : 'No professional subscribers have registered yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">
          {filtered.length} of {items.length} subscribers. Monthly prices reflect each member�s agreed rate.
        </p>
      </div>
      <Modal
        open={Boolean(selected)}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        labelledBy="manage-subscriber-title"
        panelClassName="max-w-lg"
      >
        {selected && (
          <form
            className="space-y-5 p-6"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              try {
                await membershipRequest('update-subscriber', { id: selected.id, status: nextStatus });
                await load();
                setSelected(null);
                setNotice('Membership status updated. The agreed price is unchanged.');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to update subscriber.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3 id="manage-subscriber-title" className="font-display text-xl font-semibold">
              Manage membership
            </h3>
            <div>
              <p className="font-semibold">{selected.name}</p>
              <p className="text-sm text-muted">{selected.email}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt>Account type</dt>
              <dd>{memberTypes[selected.accountType]}</dd>
              <dt>Plan</dt>
              <dd>{selected.planName}</dd>
              <dt>Agreed monthly price</dt>
              <dd>{money(selected.price)}</dd>
              <dt>Registered</dt>
              <dd>{dateText(selected.createdAt)}</dd>
            </dl>
            <label className="block text-sm">
              Membership status
              <select
                className="input mt-2"
                disabled={selected.suspended}
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
              >
                {['active', 'pending', 'past_due', 'suspended', 'cancelled'].map((value) => (
                  <option value={value} key={value}>
                    {statuses[value]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted">
              {selected.suspended
                ? 'This account is suspended. Manage account access in the Accounts section.'
                : 'This records membership standing. Account access is managed separately in Accounts.'}
            </p>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setSelected(null)}>
                Close
              </button>
              <button className="btn btn-dark" disabled={busy || selected.suspended}>
                {busy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

export function PaymentsBilling() {
  const [items, setItems] = useState<Payment[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState('');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState('paid');
  const [date, setDate] = useState(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  );
  const [selected, setSelected] = useState<Payment | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([membershipRequest('membership-payments'), membershipRequest('membership-subscribers')])
      .then(([payments, members]) => {
        if (active) {
          setItems(payments.payments);
          setSubscribers(members.subscribers);
        }
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
  const summary = monthlySummary(items);
  const chosen = subscribers.find((item) => String(item.id) === member);
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-emerald-600">Financial operations</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">Payments &amp; Billing</h2>
          <p className="mt-2 text-sm text-muted">Review subscription charges, billing records and payment outcomes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline bg-white"
            disabled={loading || !items.length}
            onClick={() =>
              download('membership-transactions.csv', [
                ['Transaction', 'Subscriber', 'Email', 'Plan', 'Amount', 'Currency', 'Date', 'Status'],
                ...items.map((item) => [
                  item.reference,
                  item.subscriberName,
                  item.subscriberEmail,
                  item.planName,
                  item.amount,
                  item.currency,
                  item.transactionDate,
                  statuses[item.status],
                ]),
              ])
            }
          >
            <Icon name="download" /> Export Transactions
          </button>
          <button
            type="button"
            className="btn btn-dark"
            disabled={loading || !subscribers.length}
            onClick={() => {
              setOpen(true);
              setError('');
              setNotice('');
            }}
          >
            Record payment
          </button>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          ['This Month', money(summary.revenue), 'Recorded paid revenue'],
          ['Successful Payments', summary.successful, 'This month'],
          ['Failed Payments', summary.failed, 'This month � requires action'],
        ].map(([title, value, description]) => (
          <div key={title} className="rounded-2xl border border-line bg-white p-6">
            <p className="text-sm font-semibold text-muted">{title}</p>
            <p className="mt-5 font-display text-4xl font-semibold">{loading ? '�' : value}</p>
            <p className="mt-3 text-xs text-muted">{description}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted">
        Payments are recorded manually from external payment confirmations. Recording a payment does not charge a card.
        Monthly totals use Sri Lanka time.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-700 text-sm">
          {notice}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-4 sm:p-7">
        <table className="w-full min-w-[850px] text-left">
          <thead className="bg-slate-50/60 border-b border-line">
            <tr>
              {['Transaction', 'Subscriber', 'Plan', 'Amount', 'Date', 'Status'].map((label) => (
                <th key={label} className={th}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-line last:border-0">
                <td className={td}>
                  <button
                    type="button"
                    className="font-semibold underline-offset-4 hover:underline"
                    onClick={() => setSelected(item)}
                  >
                    {item.reference}
                  </button>
                </td>
                <td className={td}>{item.subscriberName}</td>
                <td className={td}>{item.planName}</td>
                <td className={`${td} font-semibold`}>{money(item.amount)}</td>
                <td className={td}>{dateText(item.transactionDate)}</td>
                <td className={td}>
                  <Status value={item.status} />
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-sm text-muted">
                  {loading
                    ? 'Loading transactions...'
                    : 'No payments recorded yet. Record a confirmed payment to start the billing history.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        labelledBy="record-payment-title"
        panelClassName="max-w-lg"
      >
        <form
          className="space-y-4 p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              await membershipRequest('record-membership-payment', {
                id: member,
                reference,
                status,
                transactionDate: date,
              });
              const body = await membershipRequest('membership-payments');
              setItems(body.payments);
              setOpen(false);
              setReference('');
              setNotice('Payment outcome recorded. No charge was initiated.');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to record payment.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 id="record-payment-title" className="font-display text-xl font-semibold">
            Record payment outcome
          </h3>
          <label className="block text-sm">
            Subscriber
            <select required className="input mt-2" value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">Choose subscriber</option>
              {subscribers.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name} � {item.email}
                </option>
              ))}
            </select>
          </label>
          {chosen && (
            <p className="bg-slate-50 rounded-lg p-3 text-sm">
              {chosen.planName} � {money(chosen.price)}
              <span className="mt-1 block text-xs text-muted">Amount comes from the member�s saved monthly rate.</span>
            </p>
          )}
          <label className="block text-sm">
            External transaction / invoice reference
            <input
              required
              maxLength={120}
              className="input mt-2"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Transaction date
            <input required className="input mt-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block text-sm">
            Outcome
            <select className="input mt-2" value={status} onChange={(e) => setStatus(e.target.value)}>
              {['paid', 'failed', 'pending'].map((value) => (
                <option key={value} value={value}>
                  {statuses[value]}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-dark" disabled={busy || !chosen || chosen.price == null}>
              {busy ? 'Recording...' : 'Record outcome'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        labelledBy="payment-record-title"
        panelClassName="max-w-lg"
      >
        {selected && (
          <div className="space-y-5 p-6">
            <h3 id="payment-record-title" className="font-display text-xl font-semibold">
              Billing record
            </h3>
            <p className="font-semibold">{selected.reference}</p>
            <Status value={selected.status} />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt>Subscriber</dt>
              <dd>{selected.subscriberName}</dd>
              <dt>Email</dt>
              <dd className="break-all">{selected.subscriberEmail}</dd>
              <dt>Plan</dt>
              <dd>{selected.planName}</dd>
              <dt>Amount</dt>
              <dd>{money(selected.amount)}</dd>
              <dt>Date</dt>
              <dd>{dateText(selected.transactionDate)}</dd>
            </dl>
            <p className="text-xs text-muted">Manually recorded external payment outcome.</p>
            <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        )}
      </Modal>
    </section>
  );
}
