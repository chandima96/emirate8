'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { broker, brokerPreview, listingsFor } from '@/lib/store';
import { BrokerPublicProfile } from '@/components/profiles/BrokerPublicProfile';

function SkeletonBone({ className = '' }) {
  return <div className={`rounded bg-line/60 ${className}`} />;
}

export function BrokerPortfolioSkeleton() {
  return (
    <div className="wrap py-5 sm:py-6" role="status" aria-busy="true">
      <span className="sr-only">Loading portfolio…</span>
      <div className="motion-safe:animate-pulse">
        <SkeletonBone className="h-48 w-full rounded-lg sm:h-64" />
        <div className="relative px-1 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <SkeletonBone className="-mt-12 h-28 w-28 shrink-0 rounded-full ring-4 ring-white sm:-mt-16" />
            <div className="w-full space-y-3 pb-2">
              <SkeletonBone className="h-7 w-2/3" />
              <SkeletonBone className="h-4 w-1/2" />
              <SkeletonBone className="h-3 w-1/3" />
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <SkeletonBone className="h-10 w-full" />
              <SkeletonBone className="h-52 w-full rounded-lg" />
              <SkeletonBone className="h-52 w-full rounded-lg" />
            </div>
            <div className="space-y-4">
              <SkeletonBone className="h-44 w-full rounded-lg" />
              <SkeletonBone className="h-64 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function decode(s) {
  try {
    return decodeURIComponent(s || '');
  } catch {
    return s || '';
  }
}

/** /brokers/[slug] — Bayut-style public portfolio. `me` = the signed-in broker; ?preview=draft shows the unsaved draft; ?embed=1 hides the chrome. */
export function BrokerPortfolio({ initialBroker = null, initialListings = [], profilePath = null }) {
  const { ready, user: u } = useSession();
  useStoreVersion();
  const params = useParams();
  const sp = useSearchParams();
  const slug = decode(params.slug);
  const embed = !!sp.get('embed');

  useEffect(() => {
    if (!embed) return undefined;
    const el = document.documentElement;
    el.classList.add('is-embed');
    return () => el.classList.remove('is-embed');
  }, [embed]);

  if (!ready && !initialBroker) return <BrokerPortfolioSkeleton />;

  let b = ready ? broker(slug === 'me' && u ? u.id : slug) || initialBroker : initialBroker;
  const owner = !!(b && u && b.id === u.id);
  const previewDraft = owner && sp.get('preview') === 'draft';
  // Keep server-loaded parts the draft doesn't carry (agency team, ORN status).
  if (previewDraft) b = { ...(initialBroker || {}), ...brokerPreview(u), ...(initialBroker?.team ? { team: initialBroker.team } : {}) };

  if (!b || (!b.isPublic && !owner))
    return (
      <div className="wrap py-20 text-center">
        <Icon name="person" className="mx-auto h-8 w-8 text-muted" />
        <h1 className="h2 mt-4">This broker profile isn’t available</h1>
        <p className="mt-2 text-[14px] text-muted">The profile may be private, or the link may be incomplete.</p>
        <Link href="/agents" className="btn btn-dark mt-6">
          Find an agent
        </Link>
      </div>
    );

  // Agency admins get the agency variant; every broker (independent or on an agency team) gets the broker profile.
  const agencyOrg = b.type === 'agency' && b.agencyRole !== 'agency_broker';
  if (!agencyOrg && b.type === 'agency') b = { ...b, type: 'broker' };
  const listings = [...listingsFor(b.id), ...initialListings].filter(
    (listing, index, all) =>
      all.findIndex((item) => String(item.slug || item.id) === String(listing.slug || listing.id)) === index,
  );
  const notices: string[] = [];
  if (previewDraft) notices.push('Preview of your unsaved draft. Changes are not public until you publish.');
  if (owner && !b.isPublic) notices.push('This profile is private. Visitors see a “profile unavailable” page and it is excluded from search engines.');
  if (owner && b.isPublic && b.searchable === false) notices.push(agencyOrg ? 'Hidden from the agency directory — the page is still reachable by its link.' : 'Hidden from Find an Agent — the page is still reachable by its link.');
  return (
    <div className="e8p">
      <BrokerPublicProfile
        key={b.id + (previewDraft ? ':draft' : '')}
        b={b}
        listings={listings}
        profilePath={profilePath || undefined}
        notices={notices}
        noticeAction={
          notices.length ? (
            <p>
              <Link className="pp-link" href="/profile">
                {previewDraft ? 'Back to editing' : 'Edit profile'}
              </Link>
            </p>
          ) : null
        }
      />
    </div>
  );
}
