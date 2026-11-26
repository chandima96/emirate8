import { NextResponse, type NextRequest } from 'next/server';
import { findFeedProperty } from '@/lib/propertyFeed';
import {
  authenticateFeedRequest,
  FEED_CORS,
  feedConfigOf,
  feedProperties,
  rateLimit,
  recordFeedUse,
} from '@/lib/server/propertyFeed';

/* One property from the broker's feed, by ID, reference number or slug. */

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: FEED_CORS });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateFeedRequest(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: FEED_CORS });
  const limit = rateLimit(auth.hash);
  const headers = { ...FEED_CORS, ...limit.headers, 'Cache-Control': 'private, max-age=60' };
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
  }

  const { id } = await params;
  const property = findFeedProperty(await feedProperties(feedConfigOf(auth.feed)), decodeURIComponent(id));
  recordFeedUse(auth.payload, auth.feed);
  if (!property) {
    return NextResponse.json({ error: 'This property is not in your feed or is no longer published.' }, { status: 404, headers });
  }
  return NextResponse.json({ data: property }, { headers });
}
