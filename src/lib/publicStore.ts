/**
 * publicStore.ts — Zustand store for live public data fetched from Payload CMS.
 *
 * Replaces the static `src/data/brokers.ts` and `src/data/listings.ts` JSON copy files.
 * Data is fetched once on boot via ensureSeed() / refreshPublicData(), then updated on
 * every focus/visibilitychange through the SessionProvider refresh cycle.
 *
 * Consumers:
 *   import { usePublicBrokers, usePublicListings, usePublicPlans } from '@/lib/publicStore';
 */
import { createStore } from 'zustand/vanilla';
import { useStore as useZustandStore } from 'zustand';


// ── Types ─────────────────────────────────────────────────────────────────────

export type PublicBroker = {
  id: string | number;
  userId?: string | number;
  type?: 'broker' | 'agency';
  slug: string;
  name: string;
  title?: string;
  location?: string;
  headline?: string;
  intro?: string;
  bio?: string;
  photo?: string;
  cover?: string;
  coverPos?: number;
  initials?: string;
  tone?: number;
  areas?: string[];
  languages?: string[];
  specialties?: string[];
  experience?: string | number;
  brn?: string;
  brnVerified?: boolean;
  credentials?: { label: string; value: string; verified: boolean }[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  preferred?: string;
  agency?: { name: string; website?: string; orn?: string } | null;
  independent?: boolean;
  agencyName?: string;
  agencyId?: string;
  organizationId?: string;
  team?: Array<{
    id: string | number;
    slug?: string;
    name: string;
    initials?: string;
    title?: string;
    photo?: string;
    specialties?: string[];
  }>;
  showClosed?: boolean;
  defaultSort?: string;
  featuredOrder?: string[];
  showTransactions?: boolean;
  isPublic?: boolean;
  searchable?: boolean;
  since?: string;
  sample?: boolean;
  demo?: boolean;
  ownerMemberId?: string | number;
};

export type PublicListing = {
  id: string;
  slug?: string;
  ref?: string;
  title?: string;
  description?: string;
  status?: string;
  available?: boolean;
  purpose?: 'sale' | 'rent' | string;
  category?: 'residential' | 'commercial' | string;
  type?: string;
  completion?: 'ready' | 'offplan' | string;
  emirate?: string;
  area?: string;
  community?: string;
  price?: number;
  priceOnRequest?: boolean;
  size?: number;
  beds?: number | string;
  baths?: number | string;
  featured?: string;
  images?: string[];
  photos?: { src: string; caption: string }[];
  amenities?: string[];
  highlights?: string[];
  permit?: { number?: string; expiry?: string };
  ownership?: string;
  listed?: number;
  createdAt?: string;
  updatedAt?: string;
  brokerId?: string | number;
  broker?: PublicBroker;
  display?: { visible?: boolean; portfolioFeatured?: boolean; contact?: string };
  media?: { floorplans?: string[] };
  offplan?: { project?: string; developer?: string; handover?: string; plan?: { id: string; label: string; stage: string; pct: number; due: string }[] };
  handover?: string;
  own?: boolean;
  sample?: boolean;
  slugLocked?: boolean;
  permitStatus?: 'verified' | 'pending' | 'missing';
  ownerMemberId?: string | number;
  [key: string]: unknown;
};

export type PublicPlan = {
  id: string;
  name: string;
  roleAudience?: 'broker' | 'agency' | 'developer' | 'buyer' | 'platform';
  audience?: string;
  seats?: number | null;
  listings?: number | null;
  selections?: number;
  features?: string[];
  highlighted?: boolean;
};

type PublicState = {
  brokers: PublicBroker[];
  listings: PublicListing[];
  memberBrokers: PublicBroker[];
  plans: Record<string, PublicPlan>;
  /** Incremented each time remote data is applied — triggers reactive re-renders. */
  tick: number;
};

export type PublicData = {
  brokers?: PublicBroker[];
  listings?: PublicListing[];
  memberBrokers?: PublicBroker[];
  plans?: PublicPlan[];
};

// ── Vanilla store (used by store.ts module-level functions) ───────────────────

export const publicStore = createStore<PublicState>(() => ({
  brokers: [],
  listings: [],
  memberBrokers: [],
  plans: {},
  tick: 0,
}));

/**
 * Apply a fresh `/api/app-public` payload into the store.
 * Called by store.ts → applyPublicData().
 */
export function setPublicData(data: PublicData) {
  const plans: Record<string, PublicPlan> = {};
  if (Array.isArray(data?.plans)) {
    data.plans.forEach((p) => {
      plans[p.id] = p;
    });
  }
  publicStore.setState((s) => ({
    // The API response is authoritative. Empty arrays must clear removed CMS
    // records instead of leaving the previous in-memory snapshot visible.
    brokers: Array.isArray(data?.brokers) ? data.brokers : [],
    listings: Array.isArray(data?.listings) ? data.listings : [],
    memberBrokers: Array.isArray(data?.memberBrokers) ? data.memberBrokers : [],
    plans,
    tick: s.tick + 1,
  }));
}

let publicDataRequest: Promise<PublicData> | null = null;

/** Fetch and apply the current public dataset. Concurrent callers share one request. */
export function refreshPublicData(): Promise<PublicData> {
  if (publicDataRequest) return publicDataRequest;

  publicDataRequest = fetch('/api/app-public', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Could not load public data (${response.status}).`);
      const data = (await response.json()) as PublicData;
      setPublicData(data);
      return data;
    })
    .finally(() => {
      publicDataRequest = null;
    });

  return publicDataRequest;
}

/** Read current brokers without subscribing (for use in non-reactive store.ts functions). */
export function getPublicBrokers(): PublicBroker[] {
  return publicStore.getState().brokers;
}

/** Read current listings without subscribing. */
export function getPublicListings(): PublicListing[] {
  return publicStore.getState().listings;
}

/** Read current memberBrokers without subscribing. */
export function getPublicMemberBrokers(): PublicBroker[] {
  return publicStore.getState().memberBrokers;
}

/** Read current plans without subscribing. */
export function getPublicPlans(): Record<string, PublicPlan> {
  return publicStore.getState().plans;
}

// ── React hooks (reactive — components re-render when data changes) ───────────

/**
 * Reactive hook: re-renders when the public broker list changes.
 */
export function usePublicBrokers() {
  return useZustandStore(publicStore, (s) => s.brokers);
}

/**
 * Reactive hook: re-renders when the public listing list changes.
 */
export function usePublicListings() {
  return useZustandStore(publicStore, (s) => s.listings);
}

/**
 * Reactive hook: re-renders when member broker profiles change.
 */
export function usePublicMemberBrokers() {
  return useZustandStore(publicStore, (s) => s.memberBrokers);
}

/**
 * Reactive hook: re-renders when plan definitions change.
 */
export function usePublicPlans() {
  return useZustandStore(publicStore, (s) => s.plans);
}

/**
 * Reactive hook: tick counter — use to force a re-render whenever any public
 * data changes (e.g., on a combined brokers+listings page).
 */
export function usePublicTick() {
  return useZustandStore(publicStore, (s) => s.tick);
}
