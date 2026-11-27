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

/** The agency that owns the property with this listing ID, or null (broker-owned, developer or unknown). */
async function propertyAgencyId(payload: any, listingId: string) {
  if (!listingId) return null;
  const found = await payload.find({
    collection: 'properties',
    where: { or: [{ 'appData.id': { equals: listingId } }, ...(/^\d+$/.test(listingId) ? [{ id: { equals: listingId } }] : [])] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const ownerAgency = found.docs[0]?.ownerAgency;
  return ownerAgency == null || ownerAgency === '' ? null : relationId(ownerAgency);
}

/**
 * Resolve the recipient broker and, when the enquiry is about a listing their agency owns, that agency
 * (its inbox then shows the enquiry). A team broker's own listings and direct broker enquiries stay with
 * the broker: the agency has no part in them.
 */
async function resolveRecipient(payload: any, brokerId: string, listingAgencyId: string | null) {
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
  if (!agencyId || agencyId !== listingAgencyId) return { ...NO_RECIPIENT, brokerMember: Number(member.id) };
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
  const listingId = typeof body.propertyId === 'string' ? body.propertyId : '';
  const recipient = brokerId ? await resolveRecipient(payload, brokerId, await propertyAgencyId(payload, listingId)) : NO_RECIPIENT;

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

/* ---------- Enquiries from a partner website's embedded form ---------- */

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Validate the embedded form's fields. Returns the clean values or a list of field errors. */
export function readPartnerEnquiry(body: unknown) {
  const errors: Record<string, string> = {};
  if (!isRecord(body)) return { errors: { form: 'Invalid enquiry.' }, value: null };
  const value = {
    name: clip(body.name, 120),
    email: clip(body.email, 200).toLowerCase(),
    phone: clip(body.phone, 40),
    message: clip(body.message, 2000),
    kind: body.kind === 'viewing' ? ('viewing' as const) : ('message' as const),
    preferredDate: clip(body.preferredDate, 80),
  };
  if (value.name.length < 2) errors.name = 'Enter your name.';
  if (!EMAIL_RX.test(value.email)) errors.email = 'Enter a valid email address.';
  if (value.message.length < 10) errors.message = 'Add a short message (10+ characters).';
  if (value.kind === 'viewing' && !value.preferredDate) errors.preferredDate = 'Choose a preferred date.';
  if (body.consent !== true) errors.consent = 'Please agree so we can share your details with the broker.';
  return Object.keys(errors).length ? { errors, value: null } : { errors: null, value };
}

/**
 * Store an enquiry sent through a partner's embed of `listing` (resolved and checked by resolveEmbed).
 * It goes to the listing's broker, exactly like an enquiry from the property page, and records the feed
 * and the partner page it was sent from.
 */
export async function createPartnerEnquiry(
  payload: any,
  { feed, listing, partnerPage }: { feed: any; listing: any; partnerPage: string },
  value: NonNullable<ReturnType<typeof readPartnerEnquiry>['value']>,
) {
  const brokerId = String(listing.brokerId ?? listing.broker?.id ?? listing.owner?.id ?? '');
  const listingAgency = listing.ownerAgency == null || listing.ownerAgency === '' ? null : relationId(listing.ownerAgency);
  const recipient = brokerId ? await resolveRecipient(payload, brokerId, listingAgency) : NO_RECIPIENT;
  const created = await payload.create({
    collection: 'enquiries',
    overrideAccess: true,
    data: {
      name: value.name,
      email: value.email,
      phone: value.phone,
      message: value.message,
      type: 'property',
      kind: value.kind,
      brokerMember: recipient.brokerMember,
      brokerRef: brokerId,
      agency: recipient.agency,
      agencyName: recipient.agencyName,
      propertyRef: String(listing.id),
      propertyTitle: listing.title || '',
      preferredDate: value.kind === 'viewing' ? value.preferredDate : '',
      preferredContact: 'any',
      status: 'new',
      source: partnerPage.slice(0, 500),
      feed: Number(feed.id),
    },
  });
  return String(created.id);
}
