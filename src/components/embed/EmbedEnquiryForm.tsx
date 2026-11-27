'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field, invalidProps } from '@/components/ui/Field';
import { EMBED_RESIZE_MESSAGE } from '@/lib/propertyFeed';

/*
 * The enquiry form partner websites embed for each feed property (an iframe on our origin).
 * Enquiries are posted to /api/v1/embed/enquiry and reach the listing's broker on Emirate08.
 * The iframe reports its height to the parent page, which may use it to resize the frame.
 */

export type EmbedProperty = {
  id: string;
  title: string;
  reference: string;
  area: string;
  price: string;
  image: string | null;
  url: string;
  contactName: string;
};

const EMPTY = { name: '', email: '', phone: '', message: '', date: '', time: 'Morning', consent: false, website: '' };
type FormKey = keyof typeof EMPTY;

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export function EmbedEnquiryForm({ property, feedId, token }: { property: EmbedProperty; feedId: string; token: string }) {
  const [kind, setKind] = useState<'message' | 'viewing'>('message');
  const [form, setForm] = useState({
    ...EMPTY,
    message: `I'm interested in ${property.title}${property.reference ? ` (Ref ${property.reference})` : ''}. Please contact me.`,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Tell the partner page how tall the form is, so it can size the iframe without scrollbars.
  useEffect(() => {
    if (!root.current || window.parent === window) return;
    const post = () =>
      window.parent.postMessage(
        { type: EMBED_RESIZE_MESSAGE, propertyId: property.id, height: Math.ceil(document.documentElement.scrollHeight) },
        '*',
      );
    const observer = new ResizeObserver(post);
    observer.observe(root.current);
    post();
    return () => observer.disconnect();
  }, [property.id]);

  const set = (k: FormKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target;
    const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  const viewing = kind === 'viewing';
  const who = property.contactName || 'the broker';

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2) err.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) err.email = 'Enter a valid email address.';
    if (form.message.trim().length < 10) err.message = 'Add a short message (10+ characters).';
    if (viewing && !form.date) err.date = 'Choose a preferred date.';
    if (!form.consent) err.consent = 'Please agree so we can share your details with the broker.';
    setErrors(err);
    if (Object.keys(err).length) {
      (e.currentTarget.querySelector(`[name="${Object.keys(err)[0]}"]`) as HTMLElement | null)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/embed/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          f: feedId,
          t: token,
          propertyId: property.id,
          kind,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          message: form.message.trim(),
          preferredDate: viewing ? `${form.date} · ${form.time}` : '',
          consent: form.consent,
          website: form.website,
          partnerPage: document.referrer || '',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const { preferredDate, ...fields } = data.fields || {};
        setErrors({ ...fields, ...(preferredDate ? { date: preferredDate } : {}), form: data.error || 'Could not send the enquiry.' });
        return;
      }
      setDone(true);
    } catch {
      setErrors({ form: 'Could not send the enquiry. Check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={root} className="mx-auto max-w-[560px] rounded-xl border border-line bg-white">
      <div className="flex items-center gap-3 border-b border-line p-4">
        {property.image && (
          <img src={property.image} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-[15px] font-semibold text-ink">{property.title}</h1>
          <p className="truncate text-xs text-muted">
            {[property.price, property.area, property.reference && `Ref ${property.reference}`].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {done ? (
        <div className="p-6 text-center" role="status">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-sage">
            <Icon name="check-lg" className="h-5 w-5 text-ink" />
          </span>
          <p className="mt-3 font-display text-[17px] font-semibold text-ink">{viewing ? 'Viewing request sent' : 'Enquiry sent'}</p>
          <p className="mt-1 text-[13px] text-muted">{who} will contact you soon.</p>
        </div>
      ) : (
        <form className="grid gap-3.5 p-4" noValidate onSubmit={submit}>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Enquiry type">
            {(['message', 'viewing'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                className={'btn ' + (kind === k ? 'btn-dark' : 'btn-outline')}
                onClick={() => setKind(k)}
              >
                <Icon name={k === 'message' ? 'envelope' : 'calendar-event'} /> {k === 'message' ? 'Enquire' : 'Request viewing'}
              </button>
            ))}
          </div>
          <Field id="emb-name" label="Full name" error={errors.name}>
            <input
              id="emb-name"
              name="name"
              className="input"
              autoComplete="name"
              value={form.name}
              onChange={set('name')}
              {...invalidProps('emb-name', errors.name)}
            />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field id="emb-email" label="Email" error={errors.email}>
              <input
                id="emb-email"
                name="email"
                type="email"
                className="input"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                {...invalidProps('emb-email', errors.email)}
              />
            </Field>
            <Field id="emb-phone" label="Phone" optional="optional">
              <input
                id="emb-phone"
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
              <Field id="emb-date" label="Preferred date" error={errors.date}>
                <input
                  id="emb-date"
                  name="date"
                  type="date"
                  className="input"
                  min={tomorrow()}
                  value={form.date}
                  onChange={set('date')}
                  {...invalidProps('emb-date', errors.date)}
                />
              </Field>
              <Field id="emb-time" label="Preferred time">
                <select id="emb-time" name="time" className="select" value={form.time} onChange={set('time')}>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Evening</option>
                </select>
              </Field>
            </div>
          )}
          <Field id="emb-msg" label="Message" error={errors.message}>
            <textarea
              id="emb-msg"
              name="message"
              className="textarea"
              rows={3}
              value={form.message}
              onChange={set('message')}
              {...invalidProps('emb-msg', errors.message)}
            />
          </Field>
          {/* Honeypot: hidden from people and assistive technology; submissions that fill it are dropped. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            value={form.website}
            onChange={set('website')}
          />
          <Field error={errors.consent}>
            <label className="check">
              <input type="checkbox" name="consent" checked={form.consent} onChange={set('consent')} />
              <span>
                I agree that Emirate08 may share my details with {who} to answer my enquiry (
                <a className="link" href="/privacy" target="_blank" rel="noopener">
                  privacy policy
                </a>
                ).
              </span>
            </label>
          </Field>
          {errors.form && (
            <p className="err" role="alert">
              {errors.form}
            </p>
          )}
          <button type="submit" className="btn btn-dark btn-lg w-full" disabled={submitting}>
            {submitting ? 'Sending…' : viewing ? 'Request viewing' : 'Send enquiry'}
          </button>
          <p className="text-center text-2xs text-muted">
            Enquiries are handled by{' '}
            <a className="link" href={property.url} target="_blank" rel="noopener">
              Emirate08
            </a>
            .
          </p>
        </form>
      )}
    </div>
  );
}
