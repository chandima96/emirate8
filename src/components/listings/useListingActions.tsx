'use client';

import Link from 'next/link';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import {
  counts,
  currentUser,
  deleteListing,
  isPublic,
  listing as getListing,
  log,
  plan,
  readiness,
  saveListing,
} from '@/lib/store';
import { routes } from '@/lib/routes';
import { clone } from '@/lib/utils';

/* Status transitions shared by the list and detail views (old listings.js). */
const CONFIRM = {
  unpublished: [
    'Unpublish this listing?',
    'It will be removed from search and your public portfolio. You can publish it again at any time.',
    'Unpublish',
  ],
  sold: [
    'Mark as sold?',
    'It leaves the market. If your portfolio shows history, it appears under “Sold & rented”.',
    'Mark as sold',
  ],
  rented: [
    'Mark as rented?',
    'It leaves the market. If your portfolio shows history, it appears under “Sold & rented”.',
    'Mark as rented',
  ],
  archived: [
    'Archive this listing?',
    'Archived listings are hidden everywhere public and kept for your records.',
    'Archive',
  ],
};
const VERB = {
  published: 'Published',
  unpublished: 'Unpublished',
  sold: 'Marked as sold',
  rented: 'Marked as rented',
  archived: 'Archived',
  draft: 'Restored to draft',
  pending: 'Submitted for review',
};
const LOG_ICON = {
  published: 'send',
  unpublished: 'eye-slash',
  sold: 'check-circle',
  rented: 'key',
  archived: 'archive',
  draft: 'pencil-square',
  pending: 'hourglass-split',
};
const DERIVED = ['broker', 'images', 'available', 'listed', 'own', 'permitStatus'];

/** Listing management actions with confirmations and toasts. Each resolves to true when something changed. */
export function useListingActions() {
  const { toast, confirm } = useFeedback();

  async function changeStatus(id, to) {
    const l = getListing(id);
    if (!l) return false;
    const user = currentUser();
    if (to === 'published') {
      const r = readiness(l, user);
      if (!r.complete) {
        toast(
          <>
            Complete the listing before publishing.{' '}
            <Link className="underline" href={routes.editListing(id, 8)}>
              Open checklist
            </Link>
          </>,
          { icon: 'exclamation-circle', duration: 5000 },
        );
        return false;
      }
      if (user.credentialStatus !== 'verified') to = 'pending';
      const p = plan();
      if (to === 'published' && p.listings && counts().published >= p.listings) {
        toast(
          <>
            You’ve reached the {p.listings} published listings on your plan.{' '}
            <Link className="underline" href="/subscription">
              Compare plans
            </Link>
          </>,
          { icon: 'exclamation-circle', duration: 5000 },
        );
        return false;
      }
    }
    const c = CONFIRM[to];
    if (c && !(await confirm({ title: c[0], body: c[1], ok: c[2], danger: to === 'archived' }))) return false;
    l.status = to;
    if (to === 'published') l.display.visible = true;
    saveListing(l);
    log(VERB[to] + ' “' + l.title + '”', LOG_ICON[to]);
    toast(VERB[to] + ' “' + l.title + '”.');
    return true;
  }

  function toggleVisible(id) {
    const l = getListing(id);
    l.display.visible = l.display.visible === false;
    saveListing(l);
    toast(l.display.visible ? 'Listing is visible again.' : 'Listing hidden from the public site.');
    return true;
  }

  function toggleFeatured(id) {
    const l = getListing(id);
    l.display.portfolioFeatured = !l.display.portfolioFeatured;
    saveListing(l);
    toast(l.display.portfolioFeatured ? 'Featured on your portfolio.' : 'Removed from featured.', {
      icon: 'star-fill',
    });
    return true;
  }

  function duplicate(id) {
    const l = clone(getListing(id));
    ['id', 'slug', 'slugLocked', 'ref', 'createdAt', ...DERIVED].forEach((k) => delete l[k]);
    l.sample = false;
    l.status = 'draft';
    l.title = (l.title + ' (copy)').slice(0, 80);
    l.permit = { number: '', expiry: '' };
    l.authorised = false;
    l.display.portfolioFeatured = false;
    const saved = saveListing(l);
    if (saved && saved.error) {
      toast('Browser storage is full — remove some photos first.', { icon: 'exclamation-circle' });
      return null;
    }
    log('Duplicated “' + l.title + '” as a draft', 'copy');
    toast(
      <>
        Draft created.{' '}
        <Link className="underline" href={routes.editListing(saved.id)}>
          Edit it
        </Link>
      </>,
    );
    return saved;
  }

  async function remove(id) {
    const l = getListing(id);
    const ok = await confirm({
      title: 'Delete this listing permanently?',
      body:
        '“' +
        (l.title || 'Untitled listing') +
        '” will be removed from your workspace' +
        (isPublic(l) ? ', search results and your public portfolio' : '') +
        '. This can’t be undone. To keep a record, archive it instead.',
      ok: 'Delete permanently',
      danger: true,
    });
    if (!ok) return false;
    deleteListing(id);
    log('Deleted “' + l.title + '”', 'trash3');
    toast('Listing deleted.', { icon: 'trash3' });
    return true;
  }

  return { changeStatus, toggleVisible, toggleFeatured, duplicate, remove };
}
