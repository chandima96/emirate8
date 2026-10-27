'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar, VerifiedBadge } from '@/components/broker/Avatar';
import { contactBroker, waLink } from '@/components/broker/ContactButtons';
import { useEnquiry } from '@/components/providers/EnquiryProvider';
import { brokerUrl } from '@/lib/store';
import { digits } from '@/lib/utils';
import { PLink, inertProps, isClosed } from './shared';

/** 04e — sticky contact card: broker, Contact / Call / WhatsApp, viewing request, portfolio link. */
export function ContactSidebar({ listing: l, preview }) {
  const { openEnquiry } = useEnquiry();
  const raw = l.broker || {};
  const b = contactBroker(raw, l);
  const closed = isClosed(l);
  const inert = inertProps(preview);
  const enquire = (kind) => (preview ? inert : { onClick: () => openEnquiry({ kind, broker: raw, listing: l }) });

  return (
    <aside className="space-y-4 lg:sticky lg:top-[92px] lg:self-start" aria-label="Contact the broker">
      <div className="card p-5">
        <div className="flex items-center gap-3">
          {preview ? (
            <Avatar person={b} size={56} />
          ) : (
            <Link href={brokerUrl(b)} aria-label={`${b.name} portfolio`}>
              <Avatar person={b} size={56} />
            </Link>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-[16px] font-semibold text-ink">
              {preview ? (
                b.name
              ) : (
                <Link href={brokerUrl(b)} className="hover:underline">
                  {b.name}
                </Link>
              )}
            </p>
            <p className="truncate text-xs text-muted">{b.title || 'Real estate broker'}</p>
            <VerifiedBadge broker={b} />
          </div>
        </div>
        {!closed && (
          <>
            <button type="button" className="btn btn-dark btn-lg mt-4 w-full" {...enquire('message')}>
              <Icon name="envelope" />
              Contact the broker
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {b.phone && (
                <a className="btn btn-outline" href={preview ? '#' : `tel:+${digits(b.phone)}`} {...inert}>
                  <Icon name="telephone" />
                  Call
                </a>
              )}
              {b.whatsapp && (
                <a
                  className="btn btn-outline cbtn-wa"
                  href={preview ? '#' : waLink(b, l)}
                  {...(preview ? inert : { target: '_blank', rel: 'noopener' })}
                >
                  <Icon name="whatsapp" />
                  WhatsApp
                </a>
              )}
            </div>
          </>
        )}
      </div>
      {!closed && (
        <div className="rounded-lg bg-sage-soft p-5">
          <p className="font-display text-[15px] font-semibold text-ink">Visit with the broker</p>
          <p className="mt-1 text-[13px] leading-[1.55] text-text">
            Choose a day that suits you and the broker will confirm a viewing time.
          </p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink underline underline-offset-4"
            {...enquire('viewing')}
          >
            <Icon name="calendar-check" className="h-4 w-4" />
            Request a viewing
          </button>
        </div>
      )}
      <div className="rounded-lg bg-mist p-5">
        <p className="font-display text-[15px] font-semibold text-ink">
          More from {(b.name || '').split(' ')[0] || 'this broker'}
        </p>
        <p className="mt-1 text-[13px] leading-[1.55] text-text">
          See every active listing, credentials and the communities this broker covers.
        </p>
        <PLink
          preview={preview}
          href={brokerUrl(b)}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink underline underline-offset-4"
        >
          View broker portfolio
          <Icon name="arrow-right" className="h-3.5 w-3.5" />
        </PLink>
      </div>
    </aside>
  );
}
