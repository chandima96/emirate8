import 'server-only';
import { result, isRecord } from './result';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { syncMemberBroker } from './member-brokers';

function toAppUser(member: Record<string, any>) {
  const profile = member.profile && typeof member.profile === 'object' ? member.profile : {};
  return {
    ...profile,
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
