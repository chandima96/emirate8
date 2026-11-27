import { NextResponse, type NextRequest } from 'next/server';
import { FEED_CORS, feedAgencyId, feedTeam, recordFeedUse, startFeedRequest } from '@/lib/server/propertyFeed';

/*
 * Agency team API (v1): the agency's team members with how many of the agency's properties each handles.
 * Same API key as the property feed; agency admin keys only. One member and their properties:
 * GET /api/v1/feed/team/<id or slug>. See api-fetch.md, section 9.
 */

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: FEED_CORS });
}

export async function GET(request: NextRequest) {
  const started = await startFeedRequest(request);
  if (started.response) return started.response;
  const { auth, headers } = started;

  const agencyId = feedAgencyId(auth.feed);
  if (!agencyId) {
    return NextResponse.json({ error: 'The team API is available to agency API keys only.' }, { status: 403, headers });
  }
  const role = request.nextUrl.searchParams.get('role');
  if (role && !['broker', 'manager', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid query.', details: ['role must be "broker", "manager" or "viewer".'] }, { status: 400, headers });
  }
  const team = await feedTeam(auth.feed, agencyId);
  recordFeedUse(auth.payload, auth.feed);

  const members = team.map((entry) => entry.member).filter((member) => !role || member.role === role);
  return NextResponse.json({ data: members, meta: { total: members.length, generatedAt: new Date().toISOString() } }, { headers });
}
