'use client';

import { useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { appStore } from '@/lib/storage';
import { publicStore } from '@/lib/publicStore';

const noop = () => () => {};

/** Subscribe to the current database-backed workspace snapshot. */
export function useStoreVersion() {
  return useStore(appStore, (state) => state.version);
}

/** Subscribe to the public data tick — re-renders whenever brokers/listings/plans refresh. */
export function usePublicTick() {
  return useStore(publicStore, (state) => state.tick);
}

/** Reactively read the live public broker list from Payload CMS. */
export function usePublicBrokers() {
  return useStore(publicStore, (state) => state.brokers);
}

/** Reactively read the live public listing list from Payload CMS. */
export function usePublicListings() {
  return useStore(publicStore, (state) => state.listings);
}

/** Reactively read member broker profiles from Payload CMS. */
export function usePublicMemberBrokers() {
  return useStore(publicStore, (state) => state.memberBrokers);
}

/** Reactively read plan definitions from Payload CMS. */
export function usePublicPlans() {
  return useStore(publicStore, (state) => state.plans);
}

/** False during server rendering and the first client render, true afterwards. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
