import { NextResponse } from 'next/server';
import type { Payload } from 'payload';
import { applyFeedChange, readFeedChange, FEED_PATH } from '@/lib/propertyFeed';
import { absoluteUrl } from '@/lib/siteUrl';
import {
  canUseFeed,
  feedConfigOf,
  feedSummary,
  findFeed,
  generateApiKey,
  getFeedPayload,
  publishedListings,
  saveFeed,
} from '@/lib/server/propertyFeed';

/* Workspace management of the property feed API: selection, settings and the API key. */

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

type Context = { error?: string; status?: number; payload?: Payload; memberId?: number | string };

async function context(request: Request): Promise<Context> {
  const payload = await getFeedPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || user.collection !== 'members') return { error: 'Authentication required.', status: 401 };
  const member: any = await payload.findByID({ collection: 'members', id: user.id, depth: 0, overrideAccess: true });
  if (!canUseFeed(member)) {
    return { error: 'The property feed API is available to independent brokers and agency admins.', status: 403 };
  }
  return { payload, memberId: member.id };
}

const fail = (ctx: Context) => NextResponse.json({ error: ctx.error }, { status: ctx.status, headers: NO_STORE });
const endpoint = absoluteUrl(FEED_PATH);

export async function GET(request: Request) {
  const ctx = await context(request);
  if (ctx.error) return fail(ctx);
  const doc = await findFeed(ctx.payload, ctx.memberId);
  return NextResponse.json({ ...feedSummary(doc), endpoint }, { headers: NO_STORE });
}

/** Body: { action: 'include' | 'exclude', ids } | { action: 'settings', autoIncludeNew } | { action: 'reset' } */
export async function PATCH(request: Request) {
  const ctx = await context(request);
  if (ctx.error) return fail(ctx);
  const change = readFeedChange(await request.json().catch(() => null));
  if (!change) return NextResponse.json({ error: 'Invalid feed change.' }, { status: 400, headers: NO_STORE });
  const [doc, listings] = await Promise.all([findFeed(ctx.payload, ctx.memberId), publishedListings()]);
  const config = applyFeedChange(feedConfigOf(doc), change, listings.map((l) => String(l.id)));
  const saved = await saveFeed(ctx.payload, ctx.memberId, config);
  return NextResponse.json({ ...feedSummary(saved), endpoint }, { headers: NO_STORE });
}

/** Create or rotate the API key. The plaintext key is returned in this response only. */
export async function POST(request: Request) {
  const ctx = await context(request);
  if (ctx.error) return fail(ctx);
  const body = await request.json().catch(() => null);
  if (body?.action !== 'generate-key') return NextResponse.json({ error: 'Unknown action.' }, { status: 400, headers: NO_STORE });
  const { key, hash, prefix } = generateApiKey();
  const saved = await saveFeed(ctx.payload, ctx.memberId, {
    keyHash: hash,
    keyPrefix: prefix,
    keyCreatedAt: new Date().toISOString(),
    lastUsedAt: null,
    requestCount: 0,
  });
  return NextResponse.json({ ...feedSummary(saved), endpoint, apiKey: key }, { headers: NO_STORE });
}

/** Revoke the API key. The selection is kept so a new key serves the same properties. */
export async function DELETE(request: Request) {
  const ctx = await context(request);
  if (ctx.error) return fail(ctx);
  const saved = await saveFeed(ctx.payload, ctx.memberId, { keyHash: null, keyPrefix: null, keyCreatedAt: null });
  return NextResponse.json({ ...feedSummary(saved), endpoint }, { headers: NO_STORE });
}
