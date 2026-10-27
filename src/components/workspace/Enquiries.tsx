'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { inbox, relTime, setEnquiryStatus } from '@/lib/store';
import { routes } from '@/lib/routes';
import { Paragraphs } from './shared';

const FILTERS = [
  ['all', 'All'],
  ['new', 'New'],
  ['replied', 'Replied'],
];

/** Inbox of enquiries and viewing requests sent to the signed-in broker (old enquiries.html + enquiries.js). */
export function Enquiries() {
  useStoreVersion();
  const { toast } = useFeedback();
  const [filter, setFilter] = useState('all');
  const all = inbox();
  const count = {
    all: all.length,
    new: all.filter((e) => e.status !== 'replied').length,
    replied: all.filter((e) => e.status === 'replied').length,
  };
  const list = all.filter(
    (e) => filter === 'all' || (filter === 'replied' ? e.status === 'replied' : e.status !== 'replied'),
  );

  const toggle = (e) => {
    const replied = e.status === 'replied';
    setEnquiryStatus(e.id, replied ? 'new' : 'replied');
    toast(replied ? 'Marked as new' : 'Marked as replied');
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h2 text-[24px] lg:text-[28px]">Enquiries</h1>
          <p className="mt-1 text-[14px] text-muted">Messages and viewing requests from buyers and tenants.</p>
        </div>
        <Link href="/agents" className="btn btn-outline">
          <Icon name="box-arrow-up-right" />
          View public directory
        </Link>
      </div>
      <p className="mt-5 flex items-start gap-2 rounded-lg border border-line bg-mist px-4 py-3 text-[13px]">
        <Icon name="info-circle" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Enquiries sent to you from your public portfolio and listings. Your inbox is synced with your account.
          included. Try sending one from{' '}
          <Link className="link" href="/brokers/me">
            your portfolio
          </Link>
          . In production these would also arrive by email or WhatsApp notification.
        </span>
      </p>
      <div className="mt-6 flex items-center gap-2 border-b border-line" role="tablist" aria-label="Filter enquiries">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className="tab"
            role="tab"
            id={'eq-tab-' + k}
            aria-selected={filter === k}
            aria-controls="eq-panel"
            onClick={() => setFilter(k)}
          >
            {label} <span className="count ml-1">{count[k]}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-3" role="tabpanel" id="eq-panel" aria-labelledby={'eq-tab-' + filter}>
        {list.length ? (
          list.map((e) => {
            const replied = e.status === 'replied';
            return (
              <article key={e.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-[16px] font-semibold text-ink">{e.name}</p>
                    <p className="text-[13px] text-muted">
                      <a className="link" href={'mailto:' + e.email}>
                        {e.email}
                      </a>
                      {e.phone ? ' · ' + e.phone : ''} · {relTime(e.at)}
                    </p>
                  </div>
                  <span className={'badge ' + (replied ? 'badge-ok' : 'badge-sage')}>
                    {replied ? 'Replied' : 'New'}
                  </span>
                </div>
                <p className="mt-3 text-[13px] text-muted">
                  {e.kind === 'viewing' && <span className="badge badge-sage mr-1">Viewing request</span>}
                  {e.propertyId ? (
                    <Link className="link" href={routes.property({ id: e.propertyId })}>
                      {e.propertyTitle}
                    </Link>
                  ) : (
                    'General enquiry from your portfolio'
                  )}
                  {e.preferredDate ? ' · Preferred: ' + e.preferredDate : ''}
                </p>
                <div className="mt-2 space-y-2 text-[14px] leading-[1.6] text-text">
                  <Paragraphs text={e.message} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    className="btn btn-dark btn-sm"
                    href={
                      'mailto:' +
                      e.email +
                      '?subject=' +
                      encodeURIComponent('Re: ' + (e.propertyTitle || 'your Emirate08 enquiry'))
                    }
                  >
                    <Icon name="envelope" />
                    Reply by email
                  </a>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => toggle(e)}>
                    {replied ? 'Mark as new' : 'Mark as replied'}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <Icon name="inbox" className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-3 font-display text-[17px] font-semibold text-ink">
              {filter === 'all' ? 'No enquiries yet' : 'Nothing here'}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Enquiries sent from public profiles and property pages appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
