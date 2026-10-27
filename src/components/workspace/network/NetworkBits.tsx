'use client';

import { Fragment, useCallback, useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { deselect, fmtNumber, fmtPrice, fmtSpecs, isSelected, log, network, select } from '@/lib/store';
import { copyText } from '@/lib/share';
import { cx } from '@/lib/utils';

/* Shared broker-network renderers (old network.js: permitBadge, specLine, selectBtn, card, contact modal). */

export const netUrl = (id) => '/network/' + encodeURIComponent(id);
export const agencyOf = (n) => n.broker.agencyName || 'Independent broker';

export function PermitBadge({ n }) {
  return n.permitStatus === 'verified' ? (
    <span className="badge badge-ok">
      <Icon name="patch-check-fill" className="h-3 w-3" />
      Permit listed
    </span>
  ) : (
    <span className="badge badge-warn">
      <Icon name="clock" className="h-3 w-3" />
      Permit pending
    </span>
  );
}

export function SpecLine({ n }) {
  return fmtSpecs(n).map((s, i) => (
    <Fragment key={i}>
      {i > 0 && <span className="mx-1.5 text-line">|</span>}
      {s}
    </Fragment>
  ));
}

/** Select / deselect a network property with plan-quota enforcement and toasts. */
export function useSelectToggle() {
  const { toast } = useFeedback();
  return useCallback(
    (id) => {
      if (isSelected(id)) {
        deselect(id);
        toast('Removed from Selected Properties.', { icon: 'bookmark-dash' });
        return;
      }
      const r = select(id);
      if (!r.added) {
        toast(
          <>
            Your plan’s {fmtNumber(r.limit)} selection slots are full.{' '}
            <Link className="underline" href="/subscription">
              Compare plans
            </Link>
          </>,
          { icon: 'exclamation-circle', duration: 5000 },
        );
        return;
      }
      toast(
        <>
          Added to Selected Properties · {r.used} / {fmtNumber(r.limit)} slots used.{' '}
          <Link className="underline" href="/selected">
            View
          </Link>
        </>,
        { icon: 'bookmark-check-fill' },
      );
    },
    [toast],
  );
}

export function SelectButton({ n, small = undefined, className = undefined, onToggle }) {
  const on = isSelected(n.id);
  return (
    <button
      type="button"
      className={cx('btn', small && 'btn-sm', className, on ? 'btn-dark' : 'btn-outline')}
      aria-pressed={on}
      onClick={() => onToggle(n.id)}
    >
      <Icon name={on ? 'bookmark-check-fill' : 'bookmark'} />
      {on ? 'Selected' : 'Select'}
    </button>
  );
}

export function NetworkCard({ n, bulk = undefined, bulkChecked = undefined, onBulk = undefined, onContact, onToggle }) {
  const selected = isSelected(n.id);
  return (
    <article className="card group flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        <Link href={netUrl(n.id)} tabIndex={-1} aria-hidden="true">
          <img src={n.images[0]} alt="" className="img-cover zoom-img" loading="lazy" />
        </Link>
        {bulk && (
          <label className="absolute top-3 left-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-white/95 shadow-card">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#142326]"
              aria-label={'Choose ' + n.title + ' for bulk selection'}
              disabled={selected}
              checked={!selected && !!bulkChecked}
              onChange={(e) => onBulk(n.id, e.target.checked)}
            />
          </label>
        )}
        <span className="demo-tag absolute bottom-3 left-3">Illustrative photo</span>
        <span className="absolute top-3 right-3 rounded-sm bg-white/95 px-1.5 py-0.5 text-2xs font-semibold text-ink">
          {n.purpose === 'rent' ? 'For rent' : 'For sale'}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-[17px] font-semibold text-ink">{fmtPrice(n)}</p>
          {n.completion === 'offplan' && <span className="badge badge-sage">Off-plan</span>}
        </div>
        <h3 className="mt-1 text-[14px] leading-snug font-semibold text-ink">
          <Link href={netUrl(n.id)} className="hover:underline">
            {n.title}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <Icon name="geo-alt" className="h-3.5 w-3.5" />
          {n.area}, {n.emirate}
        </p>
        <p className="mt-2 text-xs text-text">
          <SpecLine n={n} />
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{n.broker.name}</p>
            <p className="truncate text-2xs text-muted">{agencyOf(n)}</p>
          </div>
          <PermitBadge n={n} />
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
          <SelectButton n={n} small onToggle={onToggle} />
          <Link href={netUrl(n.id)} className="btn btn-ghost btn-sm">
            Details
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm h-8 w-8 px-0"
            onClick={() => onContact(n.id)}
            aria-label={'Contact ' + n.broker.name}
          >
            <Icon name="chat-square-text" />
          </button>
        </div>
      </div>
    </article>
  );
}

function ContactBody({ n, onClose }) {
  const { toast } = useFeedback();
  const first = n.broker.name.split(' ')[0];
  const [msg, setMsg] = useState(
    'Hello ' +
      first +
      ', I’m interested in your listing “' +
      n.title +
      '” (' +
      n.area +
      ', ' +
      fmtPrice(n) +
      ') on Emirate08. Is it still available, and are you open to co-broking? Thank you.',
  );
  const copy = () => {
    const done = () => {
      toast('Message copied. Paste it into your email or WhatsApp.');
      log('Prepared a message for ' + n.broker.name + ' about “' + n.title + '”', 'chat-square-text');
    };
    copyText(msg).then(done, () => {
      (document.getElementById('ct-msg') as HTMLInputElement)?.select();
      toast('Select the message and copy it manually.', { icon: 'exclamation-circle' });
    });
  };
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Contact listing broker</p>
          <h2 id="ct-title" className="h3 mt-1.5">
            {n.broker.name}
          </h2>
          <p className="text-[13px] text-muted">
            {agencyOf(n)} · {n.broker.brn}
          </p>
        </div>
        <button type="button" className="btn btn-ghost h-9 w-9 px-0" onClick={onClose} aria-label="Close">
          <Icon name="x-lg" />
        </button>
      </div>
      <div className="mt-4 rounded-lg border border-line bg-paper p-3 text-xs text-muted">
        Regarding <span className="font-semibold text-ink">{n.title}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a className="btn btn-outline" href={'tel:' + n.broker.phone.replace(/\s/g, '')}>
          <Icon name="telephone" />
          {n.broker.phone}
        </a>
        <a
          className="btn btn-outline"
          href={
            'mailto:' +
            n.broker.email +
            '?subject=' +
            encodeURIComponent('Emirate08 enquiry: ' + n.title) +
            '&body=' +
            encodeURIComponent(msg)
          }
        >
          <Icon name="envelope" />
          Email
        </a>
      </div>
      <div className="field mt-4">
        <label className="label" htmlFor="ct-msg">
          Message
        </label>
        <textarea id="ct-msg" className="textarea" value={msg} onChange={(e) => setMsg(e.target.value)} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xs text-muted">Sample contact details · nothing is sent from this demo.</p>
        <button type="button" className="btn btn-dark" onClick={copy}>
          <Icon name="copy" />
          Copy message
        </button>
      </div>
    </>
  );
}

/** Contact-the-listing-broker dialog. `id` is a network record id (null = closed). */
export function ContactModal({ id, onClose }) {
  const n = id ? network(id) : null;
  return (
    <Modal open={!!n} onClose={onClose} labelledBy="ct-title" panelClassName="p-6" initialFocus="a[href]">
      {n && <ContactBody key={n.id} n={n} onClose={onClose} />}
    </Modal>
  );
}
