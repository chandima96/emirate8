import 'server-only';
import { result, isRecord } from './result';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

function toClientEnquiry(doc: any) {
  return {
    id: String(doc.id),
    kind: doc.kind || doc.type || 'message',
    brokerId: doc.brokerMember?.id ?? doc.brokerRef ?? '',
    brokerName: doc.brokerMember?.name || doc.brokerRef || '',
    propertyId: doc.propertyRef || '',
    propertyTitle: doc.propertyTitle || '',
    name: doc.name,
    email: doc.email,
    phone: doc.phone || '',
    message: doc.message,
    preferredDate: doc.preferredDate || '',
    at: doc.createdAt,
    status: doc.status || 'new',
    fromMember: doc.fromMember?.id ?? null,
  };
}

export async function getEnquiries(requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  if (!user || user.collection !== 'members') {
    return result({ error: 'Authentication required.' }, { status: 401 });
  }

  const found = await payload.find({
    collection: 'enquiries',
    where: {
      or: [{ brokerMember: { equals: user.id } }, { fromMember: { equals: user.id } }],
    },
    sort: '-createdAt',
    limit: 200,
    depth: 1,
    overrideAccess: true,
  });
  return result({ enquiries: found.docs.map(toClientEnquiry) });
}

export async function createEnquiry(body: unknown, requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  if (!isRecord(body)) return result({ error: 'Invalid enquiry.' }, { status: 400 });

  for (const field of ['name', 'email', 'message']) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return result({ error: `${field} is required.` }, { status: 400 });
    }
  }

  const { user } = await payload.auth({ headers: requestHeaders });
  const brokerId = body.brokerId == null ? '' : String(body.brokerId);
  const memberID = user?.collection === 'members' ? Number(user.id) : undefined;
  let brokerMember: number | undefined;
  if (brokerId && memberID != null && String(memberID) === brokerId) brokerMember = memberID;
  else if (brokerId) {
    const foundMember = await payload.find({
      collection: 'members',
      where: { id: { equals: brokerId } },
      limit: 1,
      overrideAccess: true,
    });
    if (foundMember.docs[0]) brokerMember = Number(foundMember.docs[0].id);
  }

  const created = await payload.create({
    collection: 'enquiries',
    overrideAccess: true,
    data: {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: typeof body.phone === 'string' ? body.phone : '',
      message: body.message.trim(),
      type: body.propertyId ? 'property' : 'broker',
      kind: body.kind === 'viewing' ? 'viewing' : 'message',
      brokerMember,
      brokerRef: brokerId,
      propertyRef: typeof body.propertyId === 'string' ? body.propertyId : '',
      propertyTitle: typeof body.propertyTitle === 'string' ? body.propertyTitle : '',
      preferredDate: typeof body.preferredDate === 'string' ? body.preferredDate : '',
      preferredContact: 'any',
      status: 'new',
      source: requestHeaders.get('referer') || '',
      fromMember: memberID,
    },
  });
  return result({ enquiry: toClientEnquiry(created) }, { status: 201 });
}

export async function updateEnquiryStatus(body: unknown, requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  if (!user || user.collection !== 'members') {
    return result({ error: 'Authentication required.' }, { status: 401 });
  }

  if (!isRecord(body)) return result({ error: 'Invalid enquiry.' }, { status: 400 });
  if (typeof body.id !== 'string' || !['new', 'in_progress', 'closed', 'replied'].includes(String(body.status))) {
    return result({ error: 'A valid enquiry and status are required.' }, { status: 400 });
  }

  const updated = await payload.update({
    collection: 'enquiries',
    where: {
      and: [{ id: { equals: body.id } }, { brokerMember: { equals: user.id } }],
    },
    data: { status: body.status },
    overrideAccess: true,
  });
  return result({ ok: true, updated: updated.docs.length > 0 });
}
