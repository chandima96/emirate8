'use client';

import { useEffect, useRef, useState } from 'react';
import { Field, invalidProps } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { RX } from '@/lib/utils';

/** Help centre contact form (demo — nothing is sent). */
export function HelpContact() {
  const [v, setV] = useState({ name: '', email: '', topic: 'Searching & saving', msg: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const doneRef = useRef(null);
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  const change = (k) => (e) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErr((s) => ({ ...s, [k]: '' }));
  };
  const submit = (e) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!v.name.trim()) next.name = 'This field is required.';
    if (!v.email.trim() || !RX.email.test(v.email.trim())) next.email = 'Enter a valid email address.';
    if (!v.msg.trim()) next.msg = 'This field is required.';
    setErr(next);
    if (Object.keys(next).length) return;
    setSent(true);
  };

  if (sent)
    return (
      <div className="py-2" tabIndex={-1} ref={doneRef}>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage">
          <Icon name="check-lg" className="h-5 w-5 text-ink" />
        </span>
        <p className="mt-3 font-display text-[16px] font-semibold text-ink">Thanks — message received</p>
        <p className="mt-1 text-[13px] text-muted">This is a demo, so no email was sent.</p>
      </div>
    );

  return (
    <form className="mt-5 grid gap-3.5" noValidate onSubmit={submit}>
      <Field id="hc-name" label="Name" error={err.name}>
        <input
          id="hc-name"
          className="input"
          required
          autoComplete="name"
          value={v.name}
          onChange={change('name')}
          {...invalidProps('hc-name', err.name)}
        />
      </Field>
      <Field id="hc-email" label="Email" error={err.email}>
        <input
          id="hc-email"
          type="email"
          className="input"
          required
          autoComplete="email"
          value={v.email}
          onChange={change('email')}
          {...invalidProps('hc-email', err.email)}
        />
      </Field>
      <Field id="hc-topic" label="Topic">
        <select id="hc-topic" className="select" value={v.topic} onChange={change('topic')}>
          <option>Searching &amp; saving</option>
          <option>Broker or agency account</option>
          <option>Listing a property</option>
          <option>Something else</option>
        </select>
      </Field>
      <Field id="hc-msg" label="Message" error={err.msg}>
        <textarea
          id="hc-msg"
          className="textarea"
          required
          value={v.msg}
          onChange={change('msg')}
          {...invalidProps('hc-msg', err.msg)}
        />
      </Field>
      <button type="submit" className="btn btn-dark btn-lg w-full">
        Send message
      </button>
    </form>
  );
}
