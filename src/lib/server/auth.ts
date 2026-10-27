import 'server-only';
import { result, isRecord } from './result';
import configPromise from '@payload-config';
import { generateExpiredPayloadCookie, generatePayloadCookie } from 'payload/shared';
import { getPayload } from 'payload';
import { PLAN_CATALOG } from '@/config/plans';

function safeMember(user: Record<string, any>) {
  const profile = user.profile && typeof user.profile === 'object' ? user.profile : {};
  return {
    ...profile,
    id: user.id,
    name: user.name,
    legalName: profile.legalName || user.name,
    email: user.email,
    mobile: user.mobile || '',
    type: user.accountType,
    credentialStatus: user.credentialStatus || 'pending',
    plan: user.plan || (user.accountType === 'agency' ? 'agency-bronze' : user.accountType === 'developer' ? 'developer-bronze' : 'broker-bronze'),
    adminCreated: user.adminCreated === true,
    adminAccess: user.adminAccess === true,
    mustChangePassword: user.mustChangePassword === true,
    createdAt: user.createdAt,
  };
}

function agencySlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `agency-${Date.now().toString(36)}`;
}

export async function authenticate(body: unknown, requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const members = config.collections.find((collection) => collection.slug === 'members');
  if (!members?.auth) return result({ error: 'Member authentication is unavailable.' }, { status: 500 });

  if (!isRecord(body)) return result({ error: 'Invalid authentication request.' }, { status: 400 });

  if (body.action === 'logout') {
    const response = result({ ok: true });
    response.cookie = generateExpiredPayloadCookie({
      returnCookieAsObject: true,
      collectionAuthConfig: members.auth,
      cookiePrefix: config.cookiePrefix || 'payload',
    });
    return response;
  }

  if (body.action === 'forgot-password') {
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return result({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    await payload.forgotPassword({
      collection: 'members',
      data: { email: body.email.trim().toLowerCase() },
    });
    return result({ ok: true });
  }

  if (body.action === 'reset-password') {
    if (typeof body.token !== 'string' || typeof body.password !== 'string') {
      return result({ error: 'Reset token and new password are required.' }, { status: 400 });
    }
    try {
      const reset = await payload.resetPassword({
        collection: 'members',
        data: { token: body.token, password: body.password },
        overrideAccess: true,
      });
      const response = result({ user: safeMember(reset.user as Record<string, any>) });
      if (reset.token) {
        response.cookie = generatePayloadCookie({
          returnCookieAsObject: true,
          collectionAuthConfig: members.auth,
          cookiePrefix: config.cookiePrefix || 'payload',
          token: reset.token,
        });
      }
      return response;
    } catch {
      return result({ error: 'This reset token is invalid or expired.' }, { status: 400 });
    }
  }

  if (body.action === 'first-login-password') {
    const { user: authenticatedUser } = await payload.auth({ headers: requestHeaders });
    if (!authenticatedUser || authenticatedUser.collection !== 'members') return result({ error: 'Authentication required.' }, { status: 401 });
    const member: any = await payload.findByID({ collection: 'members', id: authenticatedUser.id, overrideAccess: true });
    if (!member.mustChangePassword) return result({ error: 'A password change is not required.' }, { status: 400 });
    if (typeof body.password !== 'string' || body.password.length < 8) return result({ error: 'Use a password with at least 8 characters.' }, { status: 400 });
    await payload.update({ collection: 'members', id: member.id, overrideAccess: true, data: { password: body.password, mustChangePassword: false } as any });
    return result({ ok: true });
  }

  if (body.action === 'verify-password' || body.action === 'change-email' || body.action === 'change-password') {
    const { user: authenticatedUser } = await payload.auth({ headers: requestHeaders });
    if (!authenticatedUser || authenticatedUser.collection !== 'members') {
      return result({ error: 'Authentication required.' }, { status: 401 });
    }
    if (typeof body.currentPassword !== 'string' || !body.currentPassword) {
      return result({ error: 'Enter your current password.' }, { status: 400 });
    }

    const member = await payload.findByID({
      collection: 'members',
      id: authenticatedUser.id,
      overrideAccess: true,
    });
    try {
      await payload.login({
        collection: 'members',
        data: { email: member.email, password: body.currentPassword },
        overrideAccess: true,
      });
    } catch {
      return result({ error: 'Current password is incorrect.' }, { status: 401 });
    }

    if (body.action === 'verify-password') return result({ ok: true });

    if (body.action === 'change-email') {
      if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return result({ error: 'Enter a valid email address.' }, { status: 400 });
      }
      const updated = await payload.update({
        collection: 'members',
        id: authenticatedUser.id,
        overrideAccess: true,
        data: { email: body.email.trim().toLowerCase() },
      });
      return result({ user: safeMember(updated as Record<string, any>) });
    }

    if (typeof body.password !== 'string' || body.password.length < 8) {
      return result({ error: 'Use a password with at least 8 characters.' }, { status: 400 });
    }
    await payload.update({
      collection: 'members',
      id: authenticatedUser.id,
      overrideAccess: true,
      data: { password: body.password },
    });
    return result({ ok: true });
  }

  try {
    if (body.action === 'register') {
      if (
        typeof body.email !== 'string' ||
        typeof body.password !== 'string' ||
        typeof body.name !== 'string' ||
        !['broker', 'agency', 'buyer', 'developer'].includes(body.accountType)
      ) {
        return result({ error: 'Please provide a name, email, password and account type.' }, { status: 400 });
      }

      let profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
      if (body.accountType === 'agency') {
        const credentials = profile.credentials && typeof profile.credentials === 'object' ? profile.credentials : {};
        const name = String(credentials.agencyName || body.name).trim();
        let slug = agencySlug(name);
        const existingAgency = await payload.find({ collection: 'agencies', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true });
        if (existingAgency.docs[0]) slug = `${slug}-${Date.now().toString(36)}`;
        const agency = await payload.create({
          collection: 'agencies',
          overrideAccess: true,
          data: {
            name,
            slug,
            licenseNumber: credentials.tradeLicence || '',
            email: body.email.trim().toLowerCase(),
            description: '',
            featured: false,
            verified: false,
          },
        });
        profile = { ...profile, agency: { agencyId: agency.id, agencyRole: 'agency_admin', name, slug } };
      }

      const defaultPlan = body.accountType === 'agency' ? 'agency-bronze' : body.accountType === 'developer' ? 'developer-bronze' : body.accountType === 'broker' ? 'broker-bronze' : 'starter';
      const accountPlan = PLAN_CATALOG[body.plan]?.roleAudience === body.accountType ? body.plan : defaultPlan;
      await payload.create({
        collection: 'members',
        overrideAccess: true,
        data: {
          email: body.email.trim().toLowerCase(),
          password: body.password,
          name: body.name.trim(),
          mobile: typeof body.mobile === 'string' ? body.mobile : '',
          accountType: body.accountType,
          profile,
          credentialStatus: 'pending',
          plan: accountPlan,
          adminCreated: false,
          adminAccess: false,
        } as any,
      });
    }

    if (body.action !== 'login' && body.action !== 'register') {
      return result({ error: 'Unsupported authentication action.' }, { status: 400 });
    }
    if (typeof body.login !== 'string' && typeof body.email !== 'string') {
      return result({ error: 'Email or mobile number is required.' }, { status: 400 });
    }
    if (typeof body.password !== 'string' || !body.password) {
      return result({ error: 'Password is required.' }, { status: 400 });
    }

    const identifier = String(body.login || body.email).trim();
    const byEmail = identifier.includes('@');
    const found = await payload.find({
      collection: 'members',
      where: byEmail ? { email: { equals: identifier.toLowerCase() } } : { mobile: { equals: identifier } },
      limit: 1,
      overrideAccess: true,
    });
    const member = found.docs[0];
    if (!member?.email) {
      return result({ error: 'We could not find an account with that email or mobile number.' }, { status: 401 });
    }
    if (member.isSuspended === true) return result({ error: 'This account has been suspended. Contact an administrator.' }, { status: 403 });

    const loggedIn = await payload.login({
      collection: 'members',
      data: { email: member.email, password: body.password },
      overrideAccess: true,
    });
    if (!loggedIn.token) return result({ error: 'Sign in failed.' }, { status: 401 });

    const response = result({ user: safeMember(loggedIn.user as Record<string, any>) });
    response.cookie = generatePayloadCookie({
      returnCookieAsObject: true,
      collectionAuthConfig: members.auth,
      cookiePrefix: config.cookiePrefix || 'payload',
      token: loggedIn.token,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed.';
    const status = /duplicate|already exists/i.test(message) ? 409 : 401;
    return result({ error: status === 409 ? 'An account with this email already exists.' : message }, { status });
  }
}
