'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { contactBroker, waLink } from '@/components/broker/ContactButtons';
import { useEnquiry } from '@/components/providers/EnquiryProvider';
import { digits } from '@/lib/utils';

/** Fixed contact bar on small screens (Email · Call · WhatsApp). Not rendered in preview or for closed listings. */
export function MobileCta({ listing: l }) {
  const { openEnquiry } = useEnquiry();
  const raw = l.broker || {};
  const b = contactBroker(raw, l);

  /* Lifts toasts and the footer above the bar while it is on screen */
  useEffect(() => {
    document.body.classList.add('has-mobile-cta');
    return () => document.body.classList.remove('has-mobile-cta');
  }, []);

  return (
    <div className="mobile-cta lg:hidden">
      <button
        type="button"
        className="btn btn-dark flex-1"
        onClick={() => openEnquiry({ kind: 'message', broker: raw, listing: l })}
      >
        <Icon name="envelope" />
        Email
      </button>
      {b.phone && (
        <a className="btn btn-outline flex-1" href={`tel:+${digits(b.phone)}`}>
          <Icon name="telephone" />
          Call
        </a>
      )}
      {b.whatsapp && (
        <a className="btn btn-outline cbtn-wa flex-1" href={waLink(b, l)} target="_blank" rel="noopener">
          <Icon name="whatsapp" />
          WhatsApp
        </a>
      )}
    </div>
  );
}
