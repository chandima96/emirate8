'use client';

import { Icon } from '@/components/ui/Icon';
import { useEnquiry } from '@/components/providers/EnquiryProvider';
import { digits, cx } from '@/lib/utils';

export function waLink(b, l) {
  const n = digits(b.whatsapp);
  if (!n) return '';
  const first = (b.name || '').split(' ')[0];
  const t = l
    ? `Hello ${first}, I’m interested in “${l.title}” (${l.ref || l.id}) on Emirate08.`
    : `Hello ${first}, I found your profile on Emirate08.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(t)}`;
}

/** Applies the listing-level contact preference (any | whatsapp | call | email). Email enquiries are always available. */
export function contactBroker(b, l) {
  const pref = l?.display?.contact && l.display.contact !== 'any' ? l.display.contact : 'any';
  const override = l?.contactOverride;
  let out = override ? { ...b, phone: override.phone, whatsapp: override.whatsapp, email: override.email } : b;
  if (override?.channels?.length) {
    if (!override.channels.includes('phone')) out = { ...out, phone: '' };
    if (!override.channels.includes('whatsapp')) out = { ...out, whatsapp: '' };
  }
  if (pref === 'email' || pref === 'whatsapp') out = { ...out, phone: '' };
  if (pref === 'email' || pref === 'call') out = { ...out, whatsapp: '' };
  return out;
}

/** Email (enquiry form) · Call · WhatsApp. In `preview` mode the buttons are inert. */
export function ContactButtons({
  broker,
  listing = undefined,
  preview = false,
  size = 'btn-sm',
  waLabel = true,
  className = 'cbtn',
}) {
  const { openEnquiry } = useEnquiry();
  if (!broker) return null;
  const b = contactBroker(broker, listing);
  const inert = preview ? { tabIndex: -1, 'aria-disabled': true, onClick: (e) => e.preventDefault() } : {};
  return (
    <>
      <button
        type="button"
        className={cx('btn btn-outline', size, className)}
        {...inert}
        onClick={preview ? undefined : () => openEnquiry({ kind: 'message', broker, listing })}
      >
        <Icon name="envelope" />
        Email
      </button>
      {b.phone && (
        <a
          className={cx('btn btn-outline', size, className)}
          href={preview ? '#' : `tel:+${digits(b.phone)}`}
          {...inert}
        >
          <Icon name="telephone" />
          Call
        </a>
      )}
      {b.whatsapp && (
        <a
          className={cx('btn btn-outline', size, className, 'cbtn-wa')}
          href={preview ? '#' : waLink(b, listing)}
          {...(preview ? inert : { target: '_blank', rel: 'noopener' })}
          aria-label={`WhatsApp ${b.name}`}
        >
          <Icon name="whatsapp" />
          {waLabel && 'WhatsApp'}
        </a>
      )}
    </>
  );
}
