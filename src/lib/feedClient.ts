/*
 * Client state for the property feed API (independent brokers). The server (/api/property-feed) is the
 * source of truth; changes apply optimistically and roll back if the request fails.
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { DEFAULT_FEED, applyFeedChange, isInFeed, type FeedChange, type FeedConfig } from './propertyFeed';
import { getPublicListings } from './publicStore';

export type FeedKey = { prefix: string; createdAt: string | null; lastUsedAt: string | null; requestCount: number };
type FeedState = {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  config: FeedConfig;
  key: FeedKey | null;
  endpoint: string;
  error: string;
};

export const feedStore = createStore<FeedState>(() => ({
  status: 'idle',
  config: { ...DEFAULT_FEED },
  key: null,
  endpoint: '',
  error: '',
}));

export function useFeed() {
  return useStore(feedStore, (s) => s);
}

async function call(method: string, body?: unknown) {
  const response = await fetch('/api/property-feed', {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error || 'The property feed could not be updated.'), { status: response.status });
  return data;
}

function apply(data: any) {
  feedStore.setState({ status: 'ready', config: data.config, key: data.key, endpoint: data.endpoint || '', error: '' });
}

let loading: Promise<void> | null = null;
/** Load once per session (call again with force to refresh). Non-broker accounts get "unavailable". */
export function loadFeed(force = false) {
  if (loading && !force) return loading;
  if (!force && feedStore.getState().status === 'ready') return Promise.resolve();
  feedStore.setState({ status: feedStore.getState().status === 'ready' ? 'ready' : 'loading' });
  loading = call('GET')
    .then(apply)
    .catch((error) => {
      feedStore.setState({ status: error.status === 403 ? 'unavailable' : 'error', error: error.message });
      loading = null;
    });
  return loading;
}

export function resetFeedClient() {
  loading = null;
  feedStore.setState({ status: 'idle', config: { ...DEFAULT_FEED }, key: null, endpoint: '', error: '' });
}

export function feedAvailable() {
  return feedStore.getState().status === 'ready';
}

export function inFeed(id: string | number) {
  return isInFeed(feedStore.getState().config, id);
}

const publishedIds = () => getPublicListings().filter((l) => l.available).map((l) => String(l.id));

/** Optimistic change; resolves false (state restored) when the server rejects it. */
export async function changeFeed(change: FeedChange) {
  const before = feedStore.getState().config;
  feedStore.setState({ config: applyFeedChange(before, change, publishedIds()) });
  try {
    apply(await call('PATCH', change));
    return true;
  } catch (error) {
    feedStore.setState({ config: before, error: (error as Error).message });
    return false;
  }
}

export const includeInFeed = (ids: string | string[]) => changeFeed({ action: 'include', ids: ([] as string[]).concat(ids).map(String) });
export const excludeFromFeed = (ids: string | string[]) => changeFeed({ action: 'exclude', ids: ([] as string[]).concat(ids).map(String) });

/** Returns the plaintext key — shown once, never retrievable again. */
export async function generateFeedKey(): Promise<string> {
  const data = await call('POST', { action: 'generate-key' });
  apply(data);
  return data.apiKey;
}

export async function revokeFeedKey() {
  apply(await call('DELETE'));
}
