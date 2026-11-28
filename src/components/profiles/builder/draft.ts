import { currentUser, data, defaultPortfolio, saveUser, uniqueSlug, userById } from '@/lib/store';
import { clone, slugify } from '@/lib/utils';
import { withProfileDefaults } from '@/lib/brokerProfile';

const strip = (p: any) => {
  const c = withProfileDefaults(clone(p || {}));
  delete c.updatedAt;
  delete c.publishedAt;
  delete c.cover;
  delete c.coverPos;
  return c;
};

export function featuredListings() {
  return data().listings.filter((l) => l.display.portfolioFeatured && l.status === 'published');
}
/** Keeps the saved order for listings that are still featured and appends newly featured ones. */
export function featOrder(order: string[] | undefined) {
  const feats = featuredListings();
  const o = (order || []).filter((id) => feats.some((l) => l.id === id));
  feats.forEach((l) => {
    if (o.indexOf(l.id) < 0) o.push(l.id);
  });
  return o;
}
export function initDraft() {
  const u = currentUser();
  if (!u.portfolio) {
    u.portfolio = defaultPortfolio(u, { slug: uniqueSlug(slugify(u.name), u.id) });
    saveUser(u);
  }
  const D = withProfileDefaults(clone(u.portfolioDraft || u.portfolio));
  D.featuredOrder = featOrder(D.featuredOrder);
  return D;
}
export function isDirty(D: any) {
  const a = strip(D), b = strip(currentUser().portfolio);
  if (a.featuredOrder && !(b.featuredOrder || []).length && !a.featuredOrder.length) delete a.featuredOrder;
  if (!(b.featuredOrder || []).length && !(a.featuredOrder || []).length) { delete a.featuredOrder; delete b.featuredOrder; }
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Saves the draft on the user (or clears it when it matches the published profile). Returns false if storage refused it. */
export function persistDraft(next: any) {
  const cur = currentUser();
  if (!cur) return true;
  if (isDirty(next)) cur.portfolioDraft = clone(next);
  else delete cur.portfolioDraft;
  saveUser(cur);
  const stored = userById(cur.id);
  return JSON.stringify(stored?.portfolioDraft || null) === JSON.stringify(cur.portfolioDraft || null);
}
