'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PropertyCard } from '@/components/property/PropertyCard';
import { PropertyHCard } from '@/components/property/PropertyHCard';
import { useStoreVersion } from '@/hooks/useStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  brokerFromUser,
  currentUser,
  fmtDate,
  fmtNumber,
  fmtPrice,
  isPublic,
  listing as getListing,
  listingUrl,
  readiness,
  relTime,
} from '@/lib/store';
import { routes } from '@/lib/routes';
import { ActionsMenu } from './ActionsMenu';
import { Paragraphs, StatusBadge, VisBadge } from './bits';
import { useListingActions } from './useListingActions';

const NOTE = {
  pending: 'Waiting for credential verification before it goes live.',
  unpublished: 'Hidden from buyers. Publish again whenever you’re ready.',
  sold: 'Sold — shown in your portfolio history if enabled.',
  rented: 'Rented — shown in your portfolio history if enabled.',
  archived: 'Archived — kept for your records only.',
};

/** Workspace listing detail: card previews, key facts, payment plan, readiness checklist and status actions. */
export function ListingDetail() {
  useStoreVersion();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actions = useListingActions();
  const user = currentUser();
  const found = getListing(decodeURIComponent(id));
  const title = found ? found.title || 'Untitled listing' : '';

  useDocumentTitle(title && title + ' — My Listings · Emirate08');

  if (!found)
    return (
      <div className="mx-auto max-w-[1240px]" aria-live="polite">
        <div className="card p-10 text-center">
          <p className="h4">This listing could not be found.</p>
          <p className="mt-1 text-[13px] text-muted">It may have been deleted on this device.</p>
          <Link href="/listings" className="btn btn-dark mt-5">
            Back to My Listings
          </Link>
        </div>
      </div>
    );

  const l = { ...found, broker: brokerFromUser(user) };
  const r = readiness(l, user);
  const s = l.status;
  const rent = l.purpose === 'rent';
  const onDeleted = () => router.push('/listings');
  const note =
    s === 'published'
      ? isPublic(l)
        ? 'Live in search and on your public portfolio.'
        : 'Published but hidden — switch public visibility on in the editor.'
      : s === 'draft'
        ? r.complete
          ? 'Complete — ready to publish.'
          : 'Complete the remaining items to publish.'
        : NOTE[s] || '';
  const facts = [
    ['Price', l.price ? fmtPrice(l) : '—'],
    ['Type', (l.type || '—') + (l.completion === 'offplan' ? ' · off-plan' : '')],
    ['Bedrooms', l.category === 'commercial' ? '—' : l.beds === 0 || l.beds === '0' ? 'Studio' : l.beds || '—'],
    ['Size', l.size ? fmtNumber(l.size) + ' sqft' : '—'],
  ];

  return (
    <div className="mx-auto max-w-[1240px]" aria-live="polite">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/listings" className="hover:text-ink">
          My Listings
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{title}</span>
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge listing={l} />
            <VisBadge listing={l} />
            {l.display.portfolioFeatured && (
              <span className="badge badge-sage">
                <Icon name="star-fill" className="h-3 w-3" />
                Featured
              </span>
            )}
            {l.sample && <span className="badge badge-muted">Sample record</span>}
          </div>
          <h1 className="h2 mt-2 text-[24px] lg:text-[28px]">{title}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {[l.building || (l.offplan && l.offplan.project), l.area, l.emirate].filter(Boolean).join(', ') ||
              'No location yet'}{' '}
            · Ref {l.ref || '—'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={routes.editListing(l.id)} className="btn btn-dark">
            <Icon name="pencil-square" />
            Edit listing
          </Link>
          {isPublic(l) ? (
            <Link href={listingUrl(l)} className="btn btn-outline">
              <Icon name="box-arrow-up-right" />
              View public page
            </Link>
          ) : (
            <Link href={routes.editListing(l.id, 8)} className="btn btn-outline">
              <Icon name="eye" />
              Preview
            </Link>
          )}
          {(s === 'draft' || s === 'unpublished' || s === 'archived') && (
            <button type="button" className="btn btn-outline" onClick={() => actions.changeStatus(l.id, 'published')}>
              <Icon name="send" />
              Publish
            </button>
          )}
          {(s === 'published' || s === 'pending') && (
            <button type="button" className="btn btn-outline" onClick={() => actions.changeStatus(l.id, 'unpublished')}>
              <Icon name="eye-slash" />
              Unpublish
            </button>
          )}
          {(s === 'published' || s === 'unpublished') && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => actions.changeStatus(l.id, rent ? 'rented' : 'sold')}
            >
              <Icon name="check-circle" />
              Mark {rent ? 'rented' : 'sold'}
            </button>
          )}
          <ActionsMenu listing={l} actions={actions} onDeleted={onDeleted} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="label">Search card</p>
              <PropertyCard listing={l} preview />
            </div>
            <div className="min-w-0">
              <p className="label">Portfolio card</p>
              <PropertyHCard listing={l} preview />
            </div>
          </div>
          <div className="card mt-6 grid grid-cols-2 sm:grid-cols-4">
            {facts.map(([k, v]) => (
              <div key={k} className="border-line p-4 last:border-r-0 sm:border-r">
                <p className="text-2xs tracking-[.1em] text-muted uppercase">{k}</p>
                <p className="mt-1 font-display text-[15px] font-semibold text-ink">{v}</p>
              </div>
            ))}
          </div>
          <section className="mt-6">
            <h2 className="h4">Description</h2>
            <div className="mt-2 space-y-2 text-[14px] leading-[1.7] text-muted">
              <Paragraphs text={l.description || 'No description yet.'} />
            </div>
          </section>
          {l.completion === 'offplan' && l.offplan && l.offplan.plan.length > 0 && (
            <section className="mt-6">
              <h2 className="h4">Payment plan</h2>
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-white">
                {l.offplan.plan.map((m, i) => (
                  <li key={m.id || i} className="flex justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <span>
                      {m.label} <span className="text-muted">· {m.due || ''}</span>
                    </span>
                    <span className="font-semibold text-ink">{m.pct}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside>
          <div className="card p-5 lg:sticky lg:top-24">
            <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Publishing checklist</p>
            <ul className="mt-3 space-y-2">
              {r.checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-[13px]">
                  <Icon
                    name={c.ok ? 'check-circle-fill' : 'circle'}
                    className={'mt-0.5 h-4 w-4 shrink-0 ' + (c.ok ? 'text-ok' : 'text-muted')}
                  />
                  <span className={c.ok ? 'text-text' : 'text-muted'}>{c.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-paper p-3 text-xs leading-[1.55] text-muted">{note}</div>
            <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">Photos</dt>
                <dd>{(l.photos || []).length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Permit</dt>
                <dd>{(l.permit && l.permit.number) || 'Missing'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Created</dt>
                <dd>{fmtDate(l.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Updated</dt>
                <dd>{relTime(l.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
