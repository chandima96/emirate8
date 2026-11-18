import 'server-only';
import { result, isRecord } from './result';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

// Agency roles that oversee the whole agency inbox. `agency_broker` members only see their own enquiries.
const AGENCY_INBOX_ROLES = ['agency_admin', 'agency_manager', 'agency_viewer'];
const AGENCY_STATUS_ROLES = ['agency_admin', 'agency_manager'];

function relationId(value: any) {
  if (value == null || value === '') return null;
  return String(typeof value === 'object' ? value.id : value);
}

function memberAgencyId(member: any) {
  return relationId(member?.profile?.agency?.agencyId ?? member?.profile?.agencyId);
}

/** The agency whose inbox the signed-in member oversees, or null for brokers and independents. */
function overseenAgencyId(member: any, roles = AGENCY_INBOX_ROLES) {
  const agencyId = memberAgencyId(member);
  return agencyId && roles.includes(member?.profile?.agency?.agencyRole) ? agencyId : null;
}

function toClientEnquiry(doc: any, viewer?: any) {
  const brokerMember = doc.brokerMember && typeof doc.brokerMember === 'object' ? doc.brokerMember : null;
  const brokerId = relationId(doc.brokerMember) ?? doc.brokerRef ?? '';
  const agencyId = relationId(doc.agency);
  const viewerId = viewer ? String(viewer.id) : null;
  // direct: sent to the viewer · agency: sent to one of the viewer's agency brokers · sent: sent by the viewer
  const scope =
    viewerId && String(brokerId) === viewerId
      ? 'direct'
      : viewer && agencyId && overseenAgencyId(viewer) === agencyId
        ? 'agency'
        : 'sent';
  return {
    id: String(doc.id),
    kind: doc.kind || doc.type || 'message',
    brokerId,
    brokerName: brokerMember?.profile?.portfolio?.displayName || brokerMember?.name || doc.brokerRef || '',
    brokerEmail: scope === 'agency' ? brokerMember?.email || '' : '',
    agencyId: agencyId || '',
    agencyName: doc.agencyName || (doc.agency && typeof doc.agency === 'object' ? doc.agency.name : '') || '',
    scope,
    propertyId: doc.propertyRef || '',
    propertyTitle: doc.propertyTitle || '',
    name: doc.name,
    email: doc.email,
    phone: doc.phone || '',
    message: doc.message,
    preferredDate: doc.preferredDate || '',
    at: doc.createdAt,
    status: doc.status || 'new',
    fromMember: relationId(doc.fromMember),
  };
}

export async function getEnquiries(requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  if (!user || user.collection !== 'members') {
    return result({ error: 'Authentication required.' }, { status: 401 });
  }

  const or: any[] = [{ brokerMember: { equals: user.id } }, { fromMember: { equals: user.id } }];
  const agencyId = overseenAgencyId(user);
  if (agencyId) or.push({ agency: { equals: agencyId } });

  const found = await payload.find({
    collection: 'enquiries',
    where: { or },
    sort: '-createdAt',
    limit: 200,
    depth: 1,
    overrideAccess: true,
  });
  return result({ enquiries: found.docs.map((doc) => toClientEnquiry(doc, user)) });
}

const NO_RECIPIENT = { brokerMember: undefined, agency: undefined, agencyName: '' };

/** Resolve the recipient broker and, when they belong to one, their agency at the time of sending. */
async function resolveRecipient(payload: any, brokerId: string) {
  if (!/^\d+$/.test(brokerId)) return NO_RECIPIENT;
  const found = await payload.find({
    collection: 'members',
    where: { id: { equals: brokerId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const member = found.docs[0];
  if (!member) return NO_RECIPIENT;

  const agencyId = memberAgencyId(member);
  if (!agencyId) return { ...NO_RECIPIENT, brokerMember: Number(member.id) };
  const agencies = await payload.find({
    collection: 'agencies',
    where: { id: { equals: agencyId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const agency = agencies.docs[0];
  return {
    brokerMember: Number(member.id),
    agency: agency ? Number(agency.id) : undefined,
    agencyName: agency ? agency.name || member.profile?.agency?.name || '' : '',
  };
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
  const recipient = brokerId ? await resolveRecipient(payload, brokerId) : NO_RECIPIENT;

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
      brokerMember: recipient.brokerMember,
      brokerRef: brokerId,
      agency: recipient.agency,
      agencyName: recipient.agencyName,
      propertyRef: typeof body.propertyId === 'string' ? body.propertyId : '',
      propertyTitle: typeof body.propertyTitle === 'string' ? body.propertyTitle : '',
      preferredDate: typeof body.preferredDate === 'string' ? body.preferredDate : '',
      preferredContact: 'any',
      status: 'new',
      source: requestHeaders.get('referer') || '',
      fromMember: memberID,
    },
  });
  return result({ enquiry: toClientEnquiry(created, memberID != null ? user : undefined) }, { status: 201 });
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

  // The recipient broker can always update; agency admins/managers can also update their agency's enquiries.
  const agencyId = overseenAgencyId(user, AGENCY_STATUS_ROLES);
  const recipient = agencyId
    ? { or: [{ brokerMember: { equals: user.id } }, { agency: { equals: agencyId } }] }
    : { brokerMember: { equals: user.id } };

  const updated = await payload.update({
    collection: 'enquiries',
    where: { and: [{ id: { equals: body.id } }, recipient] },
    data: { status: body.status },
    overrideAccess: true,
  });
  return result({ ok: true, updated: updated.docs.length > 0 });
}
