'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { normalize } from '@/lib/store';
import { PropertyCard } from './PropertyCard';
import { PropertyHCard } from './PropertyHCard';
import { PropertyDetail } from './PropertyDetail';

/**
 * Iframe target for the listing editor preview. The editor (window.parent) posts the unsaved listing as
 * `{ type: 'e08-preview', mode, viewport, listing }`; this page answers `{ type: 'e08-preview-ready' }` on load.
 * `?mode=card` shows the search and portfolio cards, `?mode=page` the full public page — all inert.
 */
export function ListingPreviewClient() {
  const params = useSearchParams();
  const mode = params.get('mode') === 'page' ? 'page' : 'card';
  const [state, setState] = useState(null); // { listing, n }

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('is-embed');
    const onMessage = (e) => {
      if (e.source !== window.parent || !e.data || e.data.type !== 'e08-preview') return;
      const listing = normalize(e.data.listing);
      if (listing) setState((s) => ({ listing, n: (s?.n || 0) + 1 }));
    };
    window.addEventListener('message', onMessage);
    try {
      window.parent.postMessage({ type: 'e08-preview-ready' }, '*');
    } catch {
      /* not framed or cross-origin parent */
    }
    return () => {
      window.removeEventListener('message', onMessage);
      html.classList.remove('is-embed');
    };
  }, []);

  if (mode === 'page')
    return (
      <div className="wrap py-5 sm:py-6">
        {!state ? (
          <p className="py-20 text-center text-[14px] text-muted">Loading property…</p>
        ) : (
          <>
            <p className="mb-4 rounded-lg border border-warn/30 bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
              <Icon name="eye" className="mr-1.5 h-4 w-4" />
              Preview — this is how the published page will look. Nothing here is public yet.
            </p>
            {/* Re-mounted on every update so calculators and the map pick up the edited values, as before */}
            <PropertyDetail key={state.n} listing={state.listing} preview />
          </>
        )}
      </div>
    );

  return (
    <div className="p-4 sm:p-6">
      {!state ? (
        <p className="py-16 text-center text-[13px] text-muted">Loading preview…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <p className="label">Search results &amp; homepage</p>
            <div className="max-w-[340px]">
              <PropertyCard listing={state.listing} preview />
            </div>
          </div>
          <div className="min-w-0">
            <p className="label">Your public portfolio</p>
            <PropertyHCard key={state.n} listing={state.listing} preview />
          </div>
        </div>
      )}
    </div>
  );
}
