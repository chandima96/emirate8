import { NextResponse, type NextRequest } from 'next/server';
import { findTeamMember } from '@/lib/propertyFeed';
import { FEED_CORS, feedAgencyId, feedTeam, recordFeedUse, startFeedRequest } from '@/lib/server/propertyFeed';

/* One agency team member, by ID or profile slug, with the agency's published properties assigned to them. */

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: FEED_CORS });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const started = await startFeedRequest(request);
  if (started.response) return started.response;
  const { auth, headers } = started;

  const agencyId = feedAgencyId(auth.feed);
  if (!agencyId) {
    return NextResponse.json({ error: 'The team API is available to agency API keys only.' }, { status: 403, headers });
  }
  const { id } = await params;
  const entry = findTeamMember(await feedTeam(auth.feed, agencyId), decodeURIComponent(id));
  recordFeedUse(auth.payload, auth.feed);
  if (!entry) {
    return NextResponse.json({ error: 'No team member with this ID or slug, or their profile is private.' }, { status: 404, headers });
  }
  return NextResponse.json({ data: { ...entry.member, properties: entry.properties } }, { headers });
}
