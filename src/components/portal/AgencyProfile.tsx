'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/broker/Avatar';
import { AgentCard } from '@/components/broker/AgentCard';
import { PropertyCard } from '@/components/property/PropertyCard';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { EmptyState } from './EmptyState';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { agency, broker, brokerUrl, isPublic, listingsFor } from '@/lib/store';

/** /agencies/[id] — agency header, about, its brokers and their active listings. Unknown ids show a not-found state. */
export function AgencyProfile({ id, initialAgency = null, initialMembers = [], initialListings = [] }) {
  const { ready } = useSession();
  useStoreVersion();
  const a = ready ? agency(id) || initialAgency : initialAgency;
  const name = a ? a.name : '';
  useDocumentTitle(name && name + ' — Agency profile · Emirate08');

  const liveMembers = a ? a.brokers.map(broker).filter(Boolean) : [];
  const liveListings = a ? a.brokers.flatMap((bid) => listingsFor(bid).filter(isPublic)) : [];
  const members = liveMembers.length ? liveMembers : initialMembers;
  const listings = liveListings.length ? liveListings : initialListings;

  if (ready && !a)
    return (
      <div className="wrap py-16">
        <EmptyState
          icon="building"
          title="This agency isn’t available"
          text="It may have been removed, or the link is incorrect."
        >
          <Link href="/agents?view=agencies" className="btn btn-outline btn-sm mt-4">
            Browse agencies
          </Link>
        </EmptyState>
      </div>
    );

  return (
    <div>
      <section className="border-b border-line bg-white" aria-labelledby="g-name">
        <div className="wrap py-8 sm:py-12">
          <nav className="text-[13px] text-muted" aria-label="Breadcrumb">
            <Link href="/agents?view=agencies" className="hover:text-ink">
              Find an agency
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink">{name}</span>
          </nav>
          <div className="mt-6 grid items-center gap-6 md:grid-cols-[auto_1fr_auto] md:gap-8">
            <div>{a && <Avatar person={a} size={120} square />}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 id="g-name" className="h2">
                  {name || 'Agency'}
                </h1>
                {a && !/^sample/i.test(a.orn) ? (
                  <span className="badge badge-ok">
                    <Icon name="patch-check-fill" className="h-3 w-3" />
                    ORN on record
                  </span>
                ) : (
                  <span className="badge bg-mist text-muted">Sample agency</span>
                )}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[14px] text-muted">
                <Icon name="geo-alt" className="h-4 w-4" />
                <span>{a ? a.areas.join(' · ') : ''}</span>
              </p>
              <p className="mt-1 text-[13px] text-muted">
                <span>{a ? a.orn : ''}</span> ·{' '}
                <span>
                  {a
                    ? `${members.length} broker${members.length === 1 ? '' : 's'} · ${listings.length} active listing${
                        listings.length === 1 ? '' : 's'
                      }`
                    : ''}
                </span>
              </p>
            </div>
            <Link href={members[0] ? brokerUrl(members[0]) : '/agents'} className="btn btn-dark">
              <Icon name="envelope" />
              Contact the agency
            </Link>
          </div>
        </div>
      </section>
      <div className="wrap py-10 sm:py-12">
        <section aria-labelledby="g-about-h">
          <h2 id="g-about-h" className="h3">
            About
          </h2>
          <p className="mt-3 max-w-[720px] text-[15px] leading-[1.7]">{a ? a.about : ''}</p>
        </section>
        <section className="mt-12" aria-labelledby="g-team-h">
          <h2 id="g-team-h" className="h3">
            Brokers
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {members.map((b) => (
              <AgentCard key={b.id} broker={b} />
            ))}
          </div>
        </section>
        <section className="mt-12" aria-labelledby="g-list-h">
          <h2 id="g-list-h" className="h3">
            Active listings
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {a &&
              (listings.length ? (
                listings.map((n) => <PropertyCard key={n.id} listing={n} />)
              ) : (
                <p className="text-[14px] text-muted">No active listings right now.</p>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
