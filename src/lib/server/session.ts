import 'server-only';
import { result, isRecord } from './result';
import configPromise from '@payload-config';
import { getPayload, type Payload } from 'payload';
import { syncMemberBroker } from './member-brokers';
import { createMemberAgency } from './auth';
import { PLAN_CATALOG } from '@/config/plans';

export function toAppUser(member: Record<string, any>) {
  const profile = member.profile && typeof member.profile === 'object' ? member.profile : {};
  return {
    ...profile,
    membership: member.membership || null,
    id: member.id,
    name: member.name,
    legalName: profile.legalName || member.name,
    email: member.email,
    mobile: member.mobile || '',
    type: member.accountType === 'owner' ? 'developer' : member.accountType,
    credentialStatus: member.credentialStatus || 'pending',
    plan: member.plan || (member.accountType === 'agency' ? 'agency-bronze' : member.accountType === 'developer' ? 'developer-bronze' : 'broker-bronze'),
    adminCreated: member.adminCreated === true,
    adminAccess: member.adminAccess === true,
    mustChangePassword: member.mustChangePassword === true,
    createdAt: member.createdAt,
  };
}

export async function getSession(requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  if (!user || user.collection !== 'members') return result({ user: null });

  const member = await payload.findByID({
    collection: 'members',
    id: user.id,
    overrideAccess: true,
  });
  if (member.isSuspended === true) return result({ user: null });
  return result({ user: toAppUser(member as Record<string, any>) });
}

export async function updateSession(patch: unknown, requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  if (!user || user.collection !== 'members') {
    return result({ error: 'Authentication required.' }, { status: 401 });
  }

  if (!isRecord(patch)) return result({ error: 'Invalid account update.' }, { status: 400 });
  if ('credentialStatus' in patch && !['pending', 'verified', 'rejected'].includes(patch.credentialStatus)) {
    return result({ error: 'Invalid credential status.' }, { status: 400 });
  }

  const existing = await payload.findByID({ collection: 'members', id: user.id, overrideAccess: true });
  const profile = existing.profile && typeof existing.profile === 'object' ? existing.profile : {};
  const allowed = [
    'credentials',
    'privacy',
    'prefs',
    'notifications',
    'portfolio',
    'portfolioDraft',
    'trial',
    'trialEnds',
  ];
  const nextProfile = { ...profile } as Record<string, unknown>;
  if (patch.profile && typeof patch.profile === 'object') Object.assign(nextProfile, patch.profile);
  for (const key of allowed) {
    if (key in patch) nextProfile[key] = patch[key];
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'controlRole')) {
    nextProfile.controlRole = (profile as Record<string, unknown>).controlRole;
  }
  else delete nextProfile.controlRole;

  const updated = await payload.update({
    collection: 'members',
    id: user.id,
    overrideAccess: true,
    data: {
      ...(typeof patch.name === 'string' ? { name: patch.name } : {}),
      ...(typeof patch.mobile === 'string' ? { mobile: patch.mobile } : {}),
      ...(typeof patch.plan === 'string' ? { plan: patch.plan } : {}),
      ...(typeof patch.credentialStatus === 'string'
        ? { credentialStatus: patch.credentialStatus as 'pending' | 'verified' | 'rejected' }
        : {}),
      profile: nextProfile,
    },
  });

  await syncMemberBroker(payload, updated);

  return result({ user: toAppUser(updated as Record<string, any>) });
}

export const PRO_TYPES = ['broker', 'agency', 'developer'] as const;
export type ProType = (typeof PRO_TYPES)[number];
export type ProfessionalUpgrade = { type: ProType; plan: string; credentials: Record<string, unknown> };

const CREDENTIAL_KEYS = [
  'agencyName', 'orn', 'tradeLicence', 'agents', 'licenceFile',
  'brn', 'expiry', 'cardFile',
  'developerName', 'developerLogo',
];

/** Checks the professional details sent from the registration wizard and keeps only known fields. */
export function readProfessionalUpgrade(body: unknown, memberName: string): ProfessionalUpgrade | { error: string } {
  if (!isRecord(body) || !PRO_TYPES.includes(body.accountType)) return { error: 'Choose a professional account type.' };
  const type = body.accountType as ProType;
  const raw = isRecord(body.credentials) ? body.credentials : {};
  const credentials: Record<string, unknown> = {};
  for (const key of CREDENTIAL_KEYS) {
    const value = raw[key];
    if (typeof value === 'string') credentials[key] = value.trim().slice(0, 200);
    else if (isRecord(value) && typeof value.url === 'string') {
      credentials[key] = {
        id: value.id ?? null,
        url: value.url,
        name: String(value.name || value.filename || '').slice(0, 200),
        type: String(value.mimetype || value.type || ''),
        size: Number(value.size ?? value.filesize) || 0,
      };
    }
  }
  const text = (key: string) => String(credentials[key] || '');
  if (type === 'broker') {
    if (!/^\d{3,8}$/.test(text('brn'))) return { error: 'Enter your BRN (numbers only).' };
    if (!credentials.cardFile) return { error: 'Upload a copy of your RERA card.' };
    if (!text('expiry') || !(new Date(text('expiry')) > new Date())) return { error: 'Your RERA card must not be expired.' };
  }
  if (type === 'agency') {
    if (text('agencyName').length < 2) return { error: 'Enter the registered agency name.' };
    if (!/^\d{3,8}$/.test(text('orn'))) return { error: 'Enter a valid ORN (numbers only).' };
    if (!/^[A-Za-z0-9-]{4,15}$/.test(text('tradeLicence'))) return { error: 'Enter the trade licence number.' };
    if (!credentials.licenceFile) return { error: 'Upload a copy of your trade licence.' };
  }
  if (type === 'developer' && !text('developerName')) credentials.developerName = memberName;
  const plan = PLAN_CATALOG[body.plan]?.roleAudience === type ? String(body.plan) : `${type}-bronze`;
  return { type, plan, credentials };
}

/**
 * Turns a buyer account into a professional account. Called only once the membership is paid for
 * (or needs no payment) — see professionalCheckout.ts.
 */
export async function applyProfessionalUpgrade(
  payload: Payload,
  member: Record<string, any>,
  upgrade: ProfessionalUpgrade,
  extra: { profile?: Record<string, unknown>; membershipStatus?: string } = {},
) {
  const { type, plan, credentials } = upgrade;
  const profile = member.profile && typeof member.profile === 'object' ? { ...member.profile } : {};
  delete profile.pendingUpgrade;
  Object.assign(profile, extra.profile || {});
  profile.credentials = credentials;
  profile.trial = false;
  if (type === 'developer') {
    const logo = credentials.developerLogo as { url?: string } | undefined;
    profile.developer = { displayName: String(credentials.developerName || member.name), logo: logo?.url || '', public: true };
  }
  if (type === 'agency') {
    profile.agency = await createMemberAgency(payload, {
      name: String(credentials.agencyName || member.name).trim(),
      licence: String(credentials.tradeLicence || ''),
      email: member.email,
    });
  }
  const updated = await payload.update({
    collection: 'members',
    id: member.id,
    overrideAccess: true,
    data: {
      accountType: type,
      plan,
      credentialStatus: 'pending',
      profile,
      ...(extra.membershipStatus ? { membershipStatus: extra.membershipStatus } : {}),
    } as any,
  });
  await syncMemberBroker(payload, updated);
  return updated as Record<string, any>;
}

export async function deleteAccount(body: unknown, requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  if (!user || user.collection !== 'members') {
    return result({ error: 'Authentication required.' }, { status: 401 });
  }

  if (!isRecord(body)) return result({ error: 'Current password is required.' }, { status: 400 });
  if (typeof body.password !== 'string' || !body.password) {
    return result({ error: 'Current password is required.' }, { status: 400 });
  }
  const member = await payload.findByID({ collection: 'members', id: user.id, overrideAccess: true });
  try {
    await payload.login({
      collection: 'members',
      data: { email: member.email, password: body.password },
      overrideAccess: true,
    });
  } catch {
    return result({ error: 'Current password is incorrect.' }, { status: 401 });
  }

  await payload.delete({
    collection: 'member-state',
    where: { member: { equals: user.id } },
    overrideAccess: true,
  });
  await payload.delete({ collection: 'members', id: user.id, overrideAccess: true });
  return result({ ok: true });
}
