/* In-memory client cache backed by the authenticated Payload API (Supabase Postgres). */
import { createStore } from 'zustand/vanilla';

export const appStore = createStore<{ records: Record<string, any>; version: number }>(() => ({
  records: {},
  version: 0,
}));
let authenticated = false;
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const saving = new Set<Promise<void>>();
const saveQueues = new Map<string, Promise<void>>();
let sessionGeneration = 0;
const failedWrites = new Map<string, Error>();

/** Finish queued writes before replacing the client snapshot with server data. */
export async function flushWrites(key?: string) {
  while (pending.size || saving.size) {
    if (saving.size) await Promise.all([...saving]);
    else await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const failure = key ? failedWrites.get(key) : failedWrites.values().next().value;
  if (failure) throw failure;
}

function replace(records: Record<string, any>) {
  appStore.setState((state) => ({ records, version: state.version + 1 }));
}

export function read<T>(key: string, fallback: T): T {
  const records = appStore.getState().records;
  return Object.prototype.hasOwnProperty.call(records, key) ? records[key] : fallback;
}

export function hydrate(state: Record<string, unknown> = {}) {
  authenticated = true;
  replace({ ...state });
}

export function cache(key: string, value: unknown) {
  replace({ ...appStore.getState().records, [key]: value });
}

export function setAuthenticated(value: boolean) {
  authenticated = value;
  if (!value) {
    sessionGeneration += 1;
    pending.forEach(clearTimeout);
    pending.clear();
    failedWrites.clear();
    replace({});
  }
}

function persist(key: string, value: unknown, remove = false) {
  if (!authenticated || key === 'users' || key === 'session' || key === 'version') return;
  const existing = pending.get(key);
  if (existing) clearTimeout(existing);
  const generation = sessionGeneration;
  const body = JSON.stringify(remove ? { key } : { key, value });
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      const save = (saveQueues.get(key) || Promise.resolve()).then(async () => {
        if (generation !== sessionGeneration) return;
        try {
          const response = await fetch('/api/app-state', {
            method: remove ? 'DELETE' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body,
          });
          if (!response.ok) {
            const result = await response.json().catch(() => null);
            throw new Error(result?.error || `State save failed (${response.status}).`);
          }
          const result = await response.json().catch(() => null);
          if (generation !== sessionGeneration) return;
          failedWrites.delete(key);
          // Reconcile server-owned URLs without replacing newer local fields or photos.
          if (Array.isArray(result?.listings) && !pending.has(key)) {
            const current: any = read(key, null);
            const submitted: any = JSON.parse(body).value;
            if (Array.isArray(current?.listings)) {
              const listings = current.listings.map((listing: any) => {
                const sent = submitted?.listings?.find((item: any) => item.id === listing.id);
                const saved = result.listings.find((item: any) => item.id === listing.id);
                return sent && saved && sent.slug === listing.slug ? { ...listing, slug: saved.slug } : listing;
              });
              cache(key, { ...current, listings });
            }
          }
        } catch (error) {
          if (generation === sessionGeneration)
            failedWrites.set(key, error instanceof Error ? error : new Error(String(error)));
          console.error('[data] Could not save to Supabase:', error);
        }
      });
      saveQueues.set(key, save);
      saving.add(save);
      void save.finally(() => {
        saving.delete(save);
        if (saveQueues.get(key) === save) saveQueues.delete(key);
      });
    }, 120),
  );
}

export function write(key: string, value: unknown) {
  persist(key, value);
  cache(key, value);
  return true;
}

export function remove(key: string) {
  const records = { ...appStore.getState().records };
  delete records[key];
  persist(key, undefined, true);
  replace(records);
}

export function clearAll() {
  pending.forEach(clearTimeout);
  pending.clear();
  failedWrites.clear();
  replace({});
}

export function subscribe(fn: () => void) {
  return appStore.subscribe(fn);
}

export function getVersion() {
  return appStore.getState().version;
}
