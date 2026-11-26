import { NextResponse, type NextRequest } from 'next/server';
import { FEED_PATH, queryFeed, readFeedQuery } from '@/lib/propertyFeed';
import { absoluteUrl } from '@/lib/siteUrl';
import {
  authenticateFeedRequest,
  FEED_CORS,
  feedConfigOf,
  feedProperties,
  rateLimit,
  recordFeedUse,
} from '@/lib/server/propertyFeed';

/*
 * Public property feed API (v1). Authenticated with a broker's API key; returns the published
 * properties the broker kept in their feed. Documented on the workspace "Property Feed API" page.
 */

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: FEED_CORS });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateFeedRequest(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: FEED_CORS });
  const limit = rateLimit(auth.hash);
  const headers = { ...FEED_CORS, ...limit.headers, 'Cache-Control': 'private, max-age=60' };
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
  }

  const query = readFeedQuery(request.nextUrl.searchParams);
  if (query.errors.length) return NextResponse.json({ error: 'Invalid query.', details: query.errors }, { status: 400, headers });

  const result = queryFeed(await feedProperties(feedConfigOf(auth.feed)), query);
  recordFeedUse(auth.payload, auth.feed);

  const link = (page: number) => {
    const params = new URLSearchParams(request.nextUrl.searchParams);
    params.set('page', String(page));
    return absoluteUrl(FEED_PATH + '?' + params.toString());
  };
  return NextResponse.json(
    {
      data: result.data,
      meta: { ...result.meta, generatedAt: new Date().toISOString() },
      links: {
        self: link(result.meta.page),
        next: result.meta.page < result.meta.pages ? link(result.meta.page + 1) : null,
        prev: result.meta.page > 1 ? link(Math.min(result.meta.page - 1, result.meta.pages)) : null,
      },
    },
    { headers },
  );
}
