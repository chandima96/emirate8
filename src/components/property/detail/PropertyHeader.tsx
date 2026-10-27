'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { FavButton } from '@/components/property/FavButton';
import { fmtAlt, fmtNumber, listingUrl } from '@/lib/store';
import { routes } from '@/lib/routes';
import { share } from '@/lib/share';
import { PLink, inertProps, isClosed, locationOf } from './shared';

/** 01 — back link, breadcrumb, title, location, price and share / save actions. */
export function PropertyHeader({ listing: l, preview }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const off = l.completion === 'offplan';
  const loc = locationOf(l);
  const alt = fmtAlt(l);
  const searchHref = routes.properties({ purpose: l.purpose });

  /* Return to the results page (keeping its filters) when the visitor came from search */
  const onBack = (e) => {
    if (preview) return;
    try {
      if (document.referrer && new URL(document.referrer).pathname.startsWith('/properties')) {
        e.preventDefault();
        router.back();
      }
    } catch {
      /* invalid referrer — follow the link */
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <PLink
          preview={preview}
          href={searchHref}
          className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline"
          onClick={onBack}
        >
          <Icon name="chevron-left" className="h-3.5 w-3.5" />
          Back to search results
        </PLink>
        <nav className="text-muted" aria-label="Breadcrumb">
          <PLink preview={preview} className="hover:text-ink" href={searchHref}>
            {l.purpose === 'rent' ? 'Rent' : 'Buy'}
          </PLink>
          <span className="mx-1.5">/</span>
          <PLink preview={preview} className="hover:text-ink" href={routes.properties({ q: l.area || '' })}>
            {l.area || '—'}
          </PLink>
          <span className="mx-1.5">/</span>
          <span className="text-ink">{l.type || 'Property'}</span>
        </nav>
      </div>
      {isClosed(l) && (
        <p className="mt-4 rounded-lg border border-line bg-mist px-4 py-3 text-[13px]">
          <Icon name="info-circle" className="mr-1.5 h-4 w-4" />
          This property has been {l.status} and is shown for reference only.
        </p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {l.type || 'Property'} · {off ? 'Off-plan · ' : ''}
            {l.purpose === 'rent' ? 'For rent' : 'For sale'}
          </p>
          <h1 className="mt-1 font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[26px]">
            {l.title || 'Untitled listing'}
          </h1>
          <p className="mt-1.5 text-[14px] text-text">{loc || 'Location not set'}</p>
          <p className="mt-2 flex flex-wrap gap-4 text-[13px]">
            <a href="#location" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
              <Icon name="map" className="h-3.5 w-3.5" />
              View on map
            </a>
            <a href="#community" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
              <Icon name="signpost-split" className="h-3.5 w-3.5" />
              About {l.area || 'the area'}
            </a>
          </p>
        </div>
        <div className="md:text-right">
          <p className="font-display text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">
            {l.price ? `AED ${fmtNumber(l.price)}` : 'Price on request'}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {l.purpose === 'rent'
              ? 'per year' + (l.cheques ? ` · ${l.cheques} cheque${+l.cheques === 1 ? '' : 's'}` : '')
              : off
                ? 'starting price'
                : 'asking price'}
            {alt ? ` · ${alt}` : ''}
          </p>
          <div className="mt-3 flex gap-2 md:justify-end">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              {...inertProps(preview)}
              onClick={preview ? (e) => e.preventDefault() : () => share(l.title, listingUrl(l), toast)}
            >
              <Icon name="share" />
              Share
            </button>
            {preview ? (
              <button type="button" className="btn btn-outline btn-sm" {...inertProps(true)}>
                <Icon name="heart" />
                Save
              </button>
            ) : (
              <FavButton listing={l} className="btn btn-outline btn-sm">
                Save
              </FavButton>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
