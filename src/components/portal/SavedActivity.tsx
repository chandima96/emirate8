'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PropertyCard } from '@/components/property/PropertyCard';
import { CardSkeletons } from '@/components/ui/CardSkeletons';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { read } from '@/lib/storage';
import { broker, brokerUrl, enquiries, findListing, relTime } from '@/lib/store';
import { EmptyState } from './EmptyState';

const TABS = [
  ['saved', 'Saved'],
  ['recent', 'Recently viewed'],
  ['enquiries', 'Enquiries'],
];
const fromHash = () => {
  const h = window.location.hash.slice(1);
  return h === 'recent' || h === 'enquiries' ? h : 'saved';
};
const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

/** Saved / Recently viewed / Enquiries tabs. The tab follows the URL hash (#recent, #enquiries). */
export function SavedActivity() {
  const { ready } = useSession();
  useStoreVersion();
  const [tab, setTab] = useState('saved');

  useEffect(() => {
    const sync = () => setTab(fromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const choose = (k) => {
    window.history.replaceState(null, '', k === 'saved' ? '/saved' : '#' + k);
    setTab(k);
  };

  const saved = ready ? read('saved', []).map(findListing).filter(Boolean) : [];
  const recent = ready ? read('recent', []).map(findListing).filter(Boolean) : [];
  const enq = ready ? enquiries() : [];
  const count = { saved: saved.length, recent: recent.length, enquiries: enq.length };

  return (
    <>
      <div className="mt-7 flex overflow-x-auto border-b border-line" role="tablist" aria-label="Activity">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            id={'st-' + k}
            className="tab text-[14px]"
            role="tab"
            aria-selected={tab === k}
            aria-controls={'sp-' + k}
            onClick={() => choose(k)}
          >
            {label} <span className="count ml-1">{count[k]}</span>
          </button>
        ))}
      </div>
      <div id="sp-saved" className="mt-6" role="tabpanel" aria-labelledby="st-saved" hidden={tab !== 'saved'}>
        <div className={GRID}>
          {!ready && <CardSkeletons />}
          {ready &&
            (saved.length ? (
              saved.map((n) => <PropertyCard key={n.id} listing={n} />)
            ) : (
              <EmptyState
                icon="heart"
                title="No saved properties yet"
                text="Tap the heart on any listing to keep it here."
              >
                <Link href="/properties" className="btn btn-dark btn-sm mt-4">
                  Browse properties
                </Link>
              </EmptyState>
            ))}
        </div>
      </div>
      <div id="sp-recent" className="mt-6" role="tabpanel" aria-labelledby="st-recent" hidden={tab !== 'recent'}>
        <div className={GRID}>
          {!ready && <CardSkeletons />}
          {ready &&
            (recent.length ? (
              recent.map((n) => <PropertyCard key={n.id} listing={n} />)
            ) : (
              <EmptyState title="Nothing viewed yet" text="Properties you open appear here." />
            ))}
        </div>
      </div>
      <div
        id="sp-enquiries"
        className="mt-6"
        role="tabpanel"
        aria-labelledby="st-enquiries"
        hidden={tab !== 'enquiries'}
      >
        <div className="grid max-w-[820px] gap-3">
          {!ready && <CardSkeletons count={3} variant="summary" />}
          {ready &&
            (enq.length ? (
              enq.map((e) => <EnquiryItem key={e.id} e={e} />)
            ) : (
              <EmptyState title="No enquiries yet" text="Contact a broker from any property or profile page.">
                <Link href="/agents" className="btn btn-outline btn-sm mt-4">
                  Find an agent
                </Link>
              </EmptyState>
            ))}
        </div>
      </div>
    </>
  );
}

function EnquiryItem({ e }) {
  const b = broker(e.brokerId);
  return (
    <article className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-[16px] font-semibold text-ink">
            {e.propertyId ? (
              <Link className="hover:underline" href={'/property/' + encodeURIComponent(e.propertyId)}>
                {e.propertyTitle}
              </Link>
            ) : (
              e.propertyTitle
            )}
          </p>
          <p className="text-[13px] text-muted">
            {e.kind === 'viewing' ? 'Viewing request' : 'Message'} to{' '}
            {b ? (
              <Link className="link" href={brokerUrl(b)}>
                {e.brokerName}
              </Link>
            ) : (
              e.brokerName
            )}{' '}
            · {relTime(e.at)}
          </p>
        </div>
        <span className={'badge ' + (e.status === 'replied' ? 'badge-ok' : 'badge-muted')}>
          {e.status === 'replied' ? 'Broker replied' : 'Sent'}
        </span>
      </div>
      {e.preferredDate && <p className="mt-2 text-xs text-muted">Preferred: {e.preferredDate}</p>}
      <p className="mt-3 text-[14px] leading-[1.6] text-text">{e.message}</p>
    </article>
  );
}
