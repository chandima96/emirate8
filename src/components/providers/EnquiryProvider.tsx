'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { Field, invalidProps } from '@/components/ui/Field';
import { addEnquiry, currentUser } from '@/lib/store';
import { RX } from '@/lib/utils';

type EnquiryOptions = {
  kind?: 'message' | 'viewing';
  broker: { id?: string | number; name?: string; areas?: string[]; title?: string };
  listing?: { id?: string | number; title?: string; ref?: string };
};
const EnquiryContext = createContext<{ openEnquiry: (options: EnquiryOptions) => void }>({ openEnquiry: () => {} });

const tomorrow = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

function initialForm(o) {
  const b = o.broker;
  const l = o.listing;
  const first = (b.name || '').split(' ')[0];
  const u = currentUser();
  const message =
    o.kind === 'viewing'
      ? `Hello ${first}, I would like to view “${l ? l.title : ''}”. Please let me know if the time suits.`
      : l
        ? `Hello ${first}, is “${l.title}” still available? I would like more details.`
        : `Hello ${first}, I found your profile on Emirate08 and would like to discuss properties in ${(b.areas || [])[0] || 'Dubai'}.`;
  return {
    name: u?.name || '',
    email: u?.email || '',
    phone: u?.mobile || '',
    date: tomorrow(),
    time: 'Morning',
    message,
    consent: false,
  };
}

/**
 * Shared enquiry / viewing-request dialog. Call `openEnquiry({ kind: 'message' | 'viewing', broker, listing })`.
 * Enquiries are saved to the broker's Supabase-backed inbox.
 */
export function EnquiryProvider({ children }) {
  const [state, setState] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openEnquiry = useCallback((o) => {
    if (!o?.broker) return;
    setState(o);
    setForm(initialForm(o));
    setErrors({});
    setDone(false);
  }, []);

  const close = () => setState(null);
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2) err.name = 'Enter your name.';
    if (!RX.email.test(form.email.trim())) err.email = 'Enter a valid email address.';
    if (form.message.trim().length < 10) err.message = 'Add a short message (10+ characters).';
    if (state.kind === 'viewing' && !form.date) err.date = 'Choose a preferred date.';
    if (!form.consent) err.consent = 'Please agree so we can share your details with the broker.';
    setErrors(err);
    if (Object.keys(err).length) {
      const first = e.currentTarget.querySelector(`[name="${Object.keys(err)[0]}"]`);
      first?.focus();
      return;
    }
    const { broker: b, listing: l, kind } = state;
    setSubmitting(true);
    try {
      await addEnquiry({
        kind,
        brokerId: b.id,
        brokerName: b.name,
        propertyId: l ? l.id : '',
        propertyTitle: l ? l.title : 'General enquiry',
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        preferredDate: kind === 'viewing' ? `${form.date} · ${form.time}` : '',
        message: form.message.trim(),
      });
      setDone(true);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Could not send the enquiry.' });
    } finally {
      setSubmitting(false);
    }
  };

  const viewing = state?.kind === 'viewing';
  const b = state?.broker;
  const l = state?.listing;

  return (
    <EnquiryContext.Provider value={{ openEnquiry }}>
      {children}
      <Modal open={!!state} onClose={close} labelledBy="enq-title" panelClassName="sm:max-w-[520px]">
        {state && form && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 id="enq-title" className="h4">
                  {viewing ? 'Request a viewing' : `Email ${b.name}`}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {l ? `${l.title} · Ref ${l.ref || ''}` : b.title || 'Real estate broker'}
                </p>
              </div>
              <button type="button" className="btn btn-ghost h-9 w-9 shrink-0 px-0" onClick={close} aria-label="Close">
                <Icon name="x-lg" />
              </button>
            </div>
            {done ? (
              <div className="p-6 text-center" tabIndex={-1}>
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-sage">
                  <Icon name="check-lg" className="h-5 w-5 text-ink" />
                </span>
                <p className="mt-3 font-display text-[17px] font-semibold text-ink">
                  {viewing ? 'Viewing request sent' : 'Enquiry sent'}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  You can follow it under{' '}
                  <Link className="link" href="/saved#enquiries" onClick={close}>
                    Saved › Enquiries
                  </Link>
                  .
                </p>
                <button type="button" className="btn btn-outline mt-5" onClick={close} autoFocus>
                  Close
                </button>
              </div>
            ) : (
              <form className="grid gap-3.5 p-5" noValidate onSubmit={submit}>
                <Field id="enq-name" label="Full name" error={errors.name}>
                  <input
                    id="enq-name"
                    name="name"
                    className="input"
                    autoComplete="name"
                    value={form.name}
                    onChange={set('name')}
                    {...invalidProps('enq-name', errors.name)}
                  />
                </Field>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field id="enq-email" label="Email" error={errors.email}>
                    <input
                      id="enq-email"
                      name="email"
                      type="email"
                      className="input"
                      autoComplete="email"
                      value={form.email}
                      onChange={set('email')}
                      {...invalidProps('enq-email', errors.email)}
                    />
                  </Field>
                  <Field id="enq-phone" label="Phone" optional="optional">
                    <input
                      id="enq-phone"
                      name="phone"
                      type="tel"
                      className="input"
                      autoComplete="tel"
                      placeholder="+971 50 123 4567"
                      value={form.phone}
                      onChange={set('phone')}
                    />
                  </Field>
                </div>
                {viewing && (
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field id="enq-date" label="Preferred date" error={errors.date}>
                      <input
                        id="enq-date"
                        name="date"
                        type="date"
                        className="input"
                        min={tomorrow()}
                        value={form.date}
                        onChange={set('date')}
                      />
                    </Field>
                    <Field id="enq-time" label="Preferred time">
                      <select id="enq-time" name="time" className="select" value={form.time} onChange={set('time')}>
                        <option>Morning</option>
                        <option>Afternoon</option>
                        <option>Evening</option>
                      </select>
                    </Field>
                  </div>
                )}
                <Field id="enq-msg" label="Message" error={errors.message}>
                  <textarea
                    id="enq-msg"
                    name="message"
                    className="textarea"
                    value={form.message}
                    onChange={set('message')}
                    {...invalidProps('enq-msg', errors.message)}
                  />
                </Field>
                <Field error={errors.consent}>
                  <label className="check">
                    <input type="checkbox" name="consent" checked={form.consent} onChange={set('consent')} />
                    <span>I agree that Emirate08 may share my details with {b.name} to answer my enquiry.</span>
                  </label>
                </Field>
                {errors.form && (
                  <p className="err" role="alert">
                    {errors.form}
                  </p>
                )}
                <button type="submit" className="btn btn-dark btn-lg w-full" disabled={submitting}>
                  {viewing ? 'Request viewing' : 'Send enquiry'}
                </button>
                <p className="text-center text-2xs text-muted">
                  Your enquiry is saved securely in the platform database.
                </p>
              </form>
            )}
          </>
        )}
      </Modal>
    </EnquiryContext.Provider>
  );
}

export function useEnquiry() {
  return useContext(EnquiryContext);
}
