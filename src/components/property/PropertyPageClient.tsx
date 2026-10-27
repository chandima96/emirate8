'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { findListing, fmtPrice, isHistory, isPublic, pushRecent } from '@/lib/store';
import { STATUS } from '@/config/reference';
import { routes } from '@/lib/routes';
import { PropertyDetail } from './PropertyDetail';

function NotAvailable() {
  return (
    <div className="mx-auto max-w-[560px] py-16 text-center">
      <Icon name="house-door" className="mx-auto h-8 w-8 text-muted" />
      <h1 className="h2 mt-4">This property isn’t available</h1>
      <p className="mt-2 text-[14px] text-muted">
        The listing may have been unpublished or removed, or the link may be incomplete.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/properties" className="btn btn-dark">
          Search properties
        </Link>
        <Link href="/agents" className="btn btn-outline">
          Find an agent
        </Link>
      </div>
    </div>
  );
}

/**
 * Public property page. Shown when the listing is public, a sold/rented reference, or owned by the
 * signed-in broker (with an "only you can see this" notice). Visits are added to recently viewed.
 */
export function PropertyPageClient({ slug }) {
  const { ready, user } = useSession();
  useStoreVersion();
  const l = ready ? findListing(slug || '') : null;
  const owner = !!(l && user && l.brokerId === user.id);
  const visible = !!l && (isPublic(l) || isHistory(l) || owner);
  const id = visible ? l.id : null;
  const title = visible ? `${l.title} — ${fmtPrice(l)}` : null;

  useEffect(() => {
    if (id && !owner) pushRecent(id);
  }, [id, owner]);
  useDocumentTitle(title && `${title} · Emirate08`);

  return (
    <div className="wrap py-5 sm:py-6">
      {!ready ? (
        <p className="py-20 text-center text-[14px] text-muted">Loading property…</p>
      ) : !visible ? (
        <NotAvailable />
      ) : (
        <>
          {owner && !isPublic(l) && (
            <p className="mb-4 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn">
              <Icon name="eye-slash" className="mr-1.5 h-4 w-4" />
              Only you can see this page — the listing is {(STATUS[l.status]?.label || l.status).toLowerCase()}.{' '}
              <Link className="font-semibold underline" href={routes.editListing(l.id)}>
                Edit listing
              </Link>
            </p>
          )}
          <PropertyDetail key={l.id} listing={l} />
        </>
      )}
    </div>
  );
}
