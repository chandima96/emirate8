import 'server-only';
import { NextResponse } from 'next/server';
import type { MemberContext } from '../memberContext';

export async function markNotificationRead({ payload, member }: MemberContext, body: Record<string, any>) {
  const notification: any = await payload.findByID({ collection: 'notifications', id: body.id, overrideAccess: true });
  if (!notification || String(notification.recipient?.id || notification.recipient) !== String(member.id))
    return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  await payload.update({ collection: 'notifications', id: body.id, data: { read: true }, overrideAccess: true });
  return NextResponse.json({ ok: true });
}
