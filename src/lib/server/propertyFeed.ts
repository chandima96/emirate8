import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import configPromise from '@payload-config';
import { getPayload, type Payload } from 'payload';
import { NextResponse } from 'next/server';
import { loadPublicData } from './publicData';
import {
  DEFAULT_FEED,
  canUseFeedAccount,
  isInFeed,
  normalizeFeedConfig,
  toFeedProperty,
  toFeedTeamMember,
  type FeedConfig,
  type FeedEnquirySigner,
} from '@/lib/propertyFeed';

/* Property feed API: keys, authentication and the member's selected inventory. See src/lib/propertyFeed.ts. */

const KEY_PREFIX = 'e08_live_';

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

/** A new random key. Only the hash is stored; the plaintext is shown to the member once. */
export function generateApiKey() {
  const key = KEY_PREFIX + randomBytes(24).toString('base64url');
  return { key, hash: hashApiKey(key), prefix: key.slice(0, KEY_PREFIX.length + 4) + '…' + key.slice(-4) };
}

/** Independent brokers and agency admins with an active account (see canUseFeedAccount). */
export function canUseFeed(member: any) {
  return Boolean(
    member && member.isSuspended !== true && canUseFeedAccount(member.accountType, member.profile?.agency?.agencyRole),
  );
}

export async function getFeedPayload() {
  return getPayload({ config: await configPromise });
}

export async function findFeed(payload: Payload, memberId: string | number) {
  const { docs } = await payload.find({
    collection: 'api-feeds',
    where: { member: { equals: memberId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return (docs[0] as any) || null;
}

export async function saveFeed(payload: Payload, memberId: string | number, data: Record<string, unknown>) {
  const existing = await findFeed(payload, memberId);
  if (existing) {
    return (await payload.update({ collection: 'api-feeds', id: existing.id, data, depth: 0, overrideAccess: true })) as any;
  }
  return (await payload.create({
    collection: 'api-feeds',
    data: { member: Number(memberId), ...DEFAULT_FEED, ...data } as any,
    depth: 0,
    overrideAccess: true,
  })) as any;
}

export function feedConfigOf(doc: any): FeedConfig {
  return doc ? normalizeFeedConfig(doc) : { ...DEFAULT_FEED };
}

/** Workspace view of the feed: never includes the key hash. */
export function feedSummary(doc: any) {
  return {
    config: feedConfigOf(doc),
    key: doc?.keyHash
      ? {
          prefix: doc.keyPrefix || '',
          createdAt: doc.keyCreatedAt || null,
          lastUsedAt: doc.lastUsedAt || null,
          requestCount: Number(doc.requestCount) || 0,
        }
      : null,
  };
}

/** Every published, visible property on the platform (the same inventory as the broker network). */
export async function publishedListings() {
  const data = await loadPublicData();
  return (data.listings as any[]).filter((l) => l && l.status === 'published' && l.display?.visible !== false);
}

/** The feed's properties, each with its signed enquiry form (`enquiry.embedUrl` / `embedHtml`). */
export async function feedProperties(feed: any) {
  const config = feedConfigOf(feed);
  const signer = feed?.id != null ? enquirySigner(feed.id) : undefined;
  return (await publishedListings()).filter((l) => isInFeed(config, l.id)).map((l) => toFeedProperty(l, signer));
}

/* ---------- Embedded enquiry form links ---------- */

/*
 * An embed link names the feed and the property and carries an HMAC of both, so a partner cannot
 * credit its enquiries to another feed or point the form at a property its feed does not carry.
 * The signature does not expire: it stays valid as long as the feed exists and keeps the property.
 */
function embedSecret() {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) throw new Error('PAYLOAD_SECRET is required to sign enquiry embed links.');
  return secret;
}

export function signEmbed(feedId: string | number, propertyId: string) {
  return createHmac('sha256', embedSecret()).update(`embed-enquiry:${feedId}:${propertyId}`).digest('base64url').slice(0, 22);
}

export function verifyEmbed(feedId: string, propertyId: string, token: string) {
  if (!/^\d+$/.test(feedId) || typeof token !== 'string' || token.length !== 22) return false;
  const expected = Buffer.from(signEmbed(feedId, propertyId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function enquirySigner(feedId: string | number): FeedEnquirySigner {
  return { feedId, sign: (propertyId) => signEmbed(feedId, propertyId) };
}

/**
 * Resolve an embed link to the feed and the published listing it shows. Null when the signature is wrong,
 * the feed's owner can no longer use the feed, or the property left the feed or was unpublished.
 */
export async function resolveEmbed(feedId: string, propertyId: string, token: string) {
  if (!verifyEmbed(feedId, propertyId, token)) return null;
  const payload = await getFeedPayload();
  const feed = (await payload.findByID({ collection: 'api-feeds', id: Number(feedId), depth: 1, overrideAccess: true, disableErrors: true })) as any;
  if (!feed || !canUseFeed(feed.member)) return null;
  if (!isInFeed(feedConfigOf(feed), propertyId)) return null;
  const listing = (await publishedListings()).find((l) => String(l.id) === propertyId);
  return listing ? { payload, feed, listing } : null;
}

/* ---------- API key authentication ---------- */

export function readApiKey(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(auth)?.[1];
  const key = bearer || request.headers.get('x-api-key') || '';
  return key.startsWith(KEY_PREFIX) && key.length < 200 ? key : '';
}

/** `error` set → reject with `status`; otherwise the key's feed record (strict mode is off, so no discriminated union). */
export type FeedAuth = { error?: string; status?: number; payload?: Payload; feed?: any; hash?: string };

export async function authenticateFeedRequest(request: Request): Promise<FeedAuth> {
  const key = readApiKey(request);
  if (!key) return { status: 401, error: 'Send your API key as "Authorization: Bearer <key>" or "X-API-Key: <key>".' };
  const hash = hashApiKey(key);
  const payload = await getFeedPayload();
  const { docs } = await payload.find({
    collection: 'api-feeds',
    where: { keyHash: { equals: hash } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  // Keys are 192-bit random values looked up by their SHA-256 hash, so a plain equality lookup is safe.
  const feed: any = docs[0];
  if (!feed) {
    return { status: 401, error: 'This API key is invalid or has been revoked.' };
  }
  if (!canUseFeed(feed.member)) {
    return { status: 403, error: 'The property feed is available to active independent broker and agency accounts.' };
  }
  return { payload, feed, hash };
}

/** Usage counters are informational; a failed write never fails the API request. */
export function recordFeedUse(payload: Payload, feed: any) {
  void payload
    .update({
      collection: 'api-feeds',
      id: feed.id,
      data: { lastUsedAt: new Date().toISOString(), requestCount: (Number(feed.requestCount) || 0) + 1 },
      depth: 0,
      overrideAccess: true,
    })
    .catch((error) => console.error('[property-feed] Could not record usage:', error));
}

/* ---------- Rate limit (per key, per server instance) ---------- */

export const FEED_RATE_LIMIT = 120;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function rateLimit(hash: string, now = Date.now()) {
  const recent = (hits.get(hash) || []).filter((at) => now - at < WINDOW_MS);
  const allowed = recent.length < FEED_RATE_LIMIT;
  if (allowed) recent.push(now);
  hits.set(hash, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((at) => now - at < WINDOW_MS)) hits.delete(k);
  }
  const reset = Math.ceil(((recent[0] ?? now) + WINDOW_MS) / 1000);
  return {
    allowed,
    headers: {
      'X-RateLimit-Limit': String(FEED_RATE_LIMIT),
      'X-RateLimit-Remaining': String(Math.max(0, FEED_RATE_LIMIT - recent.length)),
      'X-RateLimit-Reset': String(reset),
    } as Record<string, string>,
  };
}

export const FEED_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-API-Key, Content-Type',
  'Access-Control-Max-Age': '86400',
};

/* ---------- Request guard shared by the feed routes ---------- */

/**
 * Authenticate the key and apply the rate limit. Returns the feed and the response headers to use,
 * or the error response to send as is.
 */
export async function startFeedRequest(request: Request) {
  const auth = await authenticateFeedRequest(request);
  if (auth.error) return { response: NextResponse.json({ error: auth.error }, { status: auth.status, headers: FEED_CORS }) };
  const limit = rateLimit(auth.hash!);
  const headers = { ...FEED_CORS, ...limit.headers, 'Cache-Control': 'private, max-age=60' };
  if (!limit.allowed) {
    return {
      response: NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } }),
    };
  }
  return { auth: auth as Required<Pick<FeedAuth, 'payload' | 'feed' | 'hash'>>, headers };
}

/* ---------- Agency team API ---------- */

const idOf = (value: any) => (value && typeof value === 'object' ? String(value.id) : value == null ? '' : String(value));

/** The agency of an agency admin's feed, or null for an independent broker's feed. */
export function feedAgencyId(feed: any) {
  const member = feed?.member;
  if (!member || member.accountType !== 'agency') return null;
  return idOf(member.profile?.agency?.agencyId ?? member.profile?.agencyId) || null;
}

/**
 * The agency's team (public profiles of its brokers, managers and viewers; members who made their profile
 * private are left out), each with the agency's published properties assigned to them that are in the feed.
 * A team broker's own listings are theirs, not the agency's, so they are not included.
 */
export async function feedTeam(feed: any, agencyId: string) {
  const data = await loadPublicData();
  const config = feedConfigOf(feed);
  const signer = enquirySigner(feed.id);
  const agencyListings = (await publishedListings()).filter(
    (l) => idOf(l.ownerAgency) === agencyId && isInFeed(config, l.id),
  );
  return (data.memberBrokers as any[])
    .filter((p) => String(p.organizationId || '') === agencyId && p.agencyRole && p.agencyRole !== 'agency_admin')
    .map((profile) => {
      const assigned = agencyListings.filter((l) => (l.brokerProfiles || []).some((b: any) => String(b?.id) === String(profile.id)));
      return { member: toFeedTeamMember(profile, assigned.length), properties: assigned.map((l) => toFeedProperty(l, signer)) };
    })
    .sort((a, b) => String(a.member.name).localeCompare(String(b.member.name)));
}
