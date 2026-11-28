import 'server-only';
import { NextResponse } from 'next/server';
import type { MemberContext } from '../memberContext';
import { memberRole } from './member';

export async function subscribeDeveloper({ payload, member }: MemberContext, body: Record<string, any>) {
  if (!['broker', 'agency'].includes(memberRole(member))) return NextResponse.json({ error: 'Only brokers and agencies can subscribe.' }, { status: 403 });
  if (!body.developerId) return NextResponse.json({ error: 'Developer is required.' }, { status: 400 });
  const existing = await payload.find({
    collection: 'developer-subscriptions',
    where: { and: [{ developer: { equals: body.developerId } }, { broker: { equals: member.id } }] },
    limit: 1,
    overrideAccess: true,
  });
  const subscription = existing.docs[0]
    ? await payload.update({ collection: 'developer-subscriptions', id: existing.docs[0].id, data: { status: 'active' }, overrideAccess: true })
    : await payload.create({ collection: 'developer-subscriptions', data: { developer: body.developerId, broker: member.id, status: 'active' }, overrideAccess: true });
  return NextResponse.json({ ok: true, subscription });
}

export async function unsubscribeDeveloper({ payload, member }: MemberContext, body: Record<string, any>) {
  if (!['broker', 'agency'].includes(memberRole(member))) return NextResponse.json({ error: 'Only brokers and agencies can unsubscribe.' }, { status: 403 });
  if (!body.developerId) return NextResponse.json({ error: 'Developer is required.' }, { status: 400 });
  const existing = await payload.find({
    collection: 'developer-subscriptions',
    where: { and: [{ developer: { equals: body.developerId } }, { broker: { equals: member.id } }] },
    limit: 1,
    overrideAccess: true,
  });
  if (!existing.docs[0]) return NextResponse.json({ ok: true });
  const subscription = await payload.update({
    collection: 'developer-subscriptions',
    id: existing.docs[0].id,
    data: { status: 'cancelled' },
    overrideAccess: true,
  });
  return NextResponse.json({ ok: true, subscription });
}
