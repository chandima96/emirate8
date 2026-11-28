import { NextResponse } from 'next/server';
import { getMemberContext } from '@/lib/server/memberContext';
import { readWorkspace } from '@/lib/server/roleWorkspace/queries';
import { markNotificationRead } from '@/lib/server/roleWorkspace/notifications';
import { subscribeDeveloper, unsubscribeDeveloper } from '@/lib/server/roleWorkspace/subscriptions';
import { inviteTeam, cancelTeamInvite, removeMember, acceptTeamInvite } from '@/lib/server/roleWorkspace/team';
import { createClaim, decideClaim } from '@/lib/server/roleWorkspace/claims';
import { createDeveloperProperty } from '@/lib/server/roleWorkspace/properties';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const current = await getMemberContext(request.headers);
  if (!current) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return readWorkspace(current, new URL(request.url).searchParams);
}

export async function POST(request: Request) {
  const current = await getMemberContext(request.headers);
  if (!current) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  switch (body?.action) {
    case 'mark-notification-read':
      return markNotificationRead(current, body);
    case 'subscribe-developer':
      return subscribeDeveloper(current, body);
    case 'unsubscribe-developer':
      return unsubscribeDeveloper(current, body);
    case 'invite-team':
      return inviteTeam(current, body);
    case 'cancel-team-invite':
      return cancelTeamInvite(current, body);
    case 'remove-team-member':
      return removeMember(current, body);
    case 'accept-team-invite':
      return acceptTeamInvite(current, body);
    case 'create-claim':
      return createClaim(current, body);
    case 'decide-claim':
      return decideClaim(current, body);
    case 'create-developer-property':
      return createDeveloperProperty(current, body);
    default:
      return NextResponse.json({ error: 'Unsupported role workspace action.' }, { status: 400 });
  }
}
