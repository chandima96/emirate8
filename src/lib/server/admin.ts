import 'server-only';
import { PLAN_CATALOG, planIdForAudience } from '@/config/plans';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { generateExpiredPayloadCookie, generatePayloadCookie } from 'payload/shared';
import { result, isRecord } from './result';
import { generateTemporaryPassword, sendNewMemberCredentials, smtpFailureHint } from './mailer';

const controlUsers = (user: any) =>
  Boolean(user && user.collection === 'users' && ['admin', 'subadmin', 'verifier'].includes(user.role));

function controlRole(user: any) {
  if (user?.collection === 'users' && ['admin', 'subadmin', 'verifier'].includes(user.role)) return user.role;
  const profile = user?.profile && typeof user.profile === 'object' ? user.profile : {};
  return profile.controlRole === 'verifier' ? 'verifier' : 'subadmin';
}

function verifierUser(user: any) {
  return controlRole(user) === 'verifier';
}

function propertyVerification(property: any) {
  // Member-created listings keep the original editor payload in appData. Use it
  // as a fallback while older records are being backfilled with the canonical
  // permit upload field.
  const permit = { ...(property.appData?.permit || {}), ...(property.permit || {}) };
  const photos = Array.isArray(property.photos) ? property.photos : [];
  const checks = [
    {
      key: 'identity',
      label: 'Property identity',
      submitted:
        [property.title, property.area, property.type].filter(Boolean).join(' · ') || 'Missing title, area or type',
      evidence: 'Title, area and property type are filled',
      ok: Boolean(property.title && property.area && property.type),
    },
    {
      key: 'pricing',
      label: 'Pricing',
      submitted: property.price
        ? `${property.purpose || 'Unknown purpose'} · AED ${Number(property.price).toLocaleString('en-AE')}`
        : 'Price missing',
      evidence: 'Purpose and asking price are present',
      ok: Boolean(property.purpose && property.price > 0),
    },
    {
      key: 'specifications',
      label: 'Specifications',
      submitted:
        [
          property.size ? `${property.size} sqft` : '',
          property.beds != null ? `${property.beds} beds` : '',
          property.baths != null ? `${property.baths} baths` : '',
        ]
          .filter(Boolean)
          .join(' · ') || 'No size or room data',
      evidence: 'Size, bedrooms and bathrooms are supplied',
      ok: Boolean(property.size && property.beds != null && property.baths != null),
    },
    {
      key: 'permit',
      label: 'Advertising permit',
      submitted:
        permit.number && permit.expiry
          ? `${permit.number} · expires ${String(permit.expiry).slice(0, 10)}`
          : 'Permit number or expiry missing',
      evidence: permit.document || 'Upload the issued permit e-Certificate',
      ok: Boolean(
        permit.number &&
          permit.expiry &&
          permit.document &&
          new Date(permit.expiry).getTime() >= Date.now(),
      ),
    },
    {
      key: 'media',
      label: 'Media evidence',
      submitted: `${photos.length} gallery photo${photos.length === 1 ? '' : 's'}${property.featuredImage ? ' · featured image supplied' : ''}`,
      evidence: 'At least 3 gallery photos and a featured image',
      ok: photos.length >= 3 && Boolean(property.featuredImage),
    },
    {
      key: 'broker',
      label: 'Responsible broker',
      submitted: property.broker ? 'Broker linked' : 'No broker linked',
      evidence: 'Listing is linked to a responsible broker',
      ok: Boolean(property.broker),
    },
  ];
  return { checks, ready: checks.every((check) => check.ok) };
}

function controlUser(user: any) {
  return {
    id: user.id,
    name: user.name || user.email,
    email: user.email,
    kind: user.collection === 'users' ? 'admin' : 'staff',
    role: controlRole(user),
    mustChangePassword: user.mustChangePassword === true,
  };
}

async function authControlUser(payload: any, headers: Headers) {
  const { user } = await payload.auth({ headers });
  if (controlUsers(user)) {
    const fresh: any = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true });
    return fresh.isSuspended === true ? null : fresh;
  }
  if (user?.collection === 'members') {
    const member = await payload.findByID({ collection: 'members', id: user.id, overrideAccess: true });
    if (member.adminAccess === true && member.adminCreated === true && member.isSuspended !== true) return member;
  }
  return null;
}

export async function adminRequest(body: unknown, headers: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });

  if (!isRecord(body)) return result({ error: 'Invalid control room request.' }, { status: 400 });

  if (body.action === 'logout') {
    const response = result({ ok: true });
    response.cookie = generateExpiredPayloadCookie({
      returnCookieAsObject: true,
      collectionAuthConfig: config.collections.find((c) => c.slug === 'users')?.auth,
      cookiePrefix: config.cookiePrefix || 'payload',
    });
    return response;
  }

  if (body.action === 'login') {
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      return result({ error: 'Email and password are required.' }, { status: 400 });
    }
    const email = body.email.trim().toLowerCase();
    const targetStaff: any = (await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })).docs[0];
    if (targetStaff?.isSuspended === true) return result({ error: 'This account has been suspended. Contact an administrator.' }, { status: 403 });
    const targetMember: any = (await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, overrideAccess: true })).docs[0];
    if (targetMember?.isSuspended === true) return result({ error: 'This account has been suspended. Contact an administrator.' }, { status: 403 });
    try {
      const adminLogin = await payload.login({ collection: 'users', data: { email, password: body.password } });
      if (adminLogin.token && controlUsers(adminLogin.user)) {
        const response = result({ user: controlUser(adminLogin.user) });
        response.cookie = generatePayloadCookie({
          returnCookieAsObject: true,
          collectionAuthConfig: config.collections.find((c) => c.slug === 'users')?.auth,
          cookiePrefix: config.cookiePrefix || 'payload',
          token: adminLogin.token,
        });
        return response;
      }
    } catch {}

    // Only try the members auth collection for accounts that are actually
    // eligible for Control Room access. The regular login form calls this
    // endpoint after a failed member login; trying every member here would
    // count one bad password submission twice and lock accounts twice as fast.
    if (targetMember?.adminAccess === true && targetMember?.adminCreated === true) {
      try {
        const memberLogin = await payload.login({ collection: 'members', data: { email, password: body.password } });
        if (memberLogin.token && memberLogin.user?.adminAccess === true && memberLogin.user?.adminCreated === true) {
          const response = result({ user: controlUser(memberLogin.user) });
          response.cookie = generatePayloadCookie({
            returnCookieAsObject: true,
            collectionAuthConfig: config.collections.find((c) => c.slug === 'members')?.auth,
            cookiePrefix: config.cookiePrefix || 'payload',
            token: memberLogin.token,
          });
          return response;
        }
      } catch {}
    }
    return result({ error: 'Control Room access is limited to approved admin accounts.' }, { status: 401 });
  }

  const current = await authControlUser(payload, headers);
  if (!current) return result({ error: 'Control Room authentication required.' }, { status: 401 });
  if (body.action === 'session') return result({ user: controlUser(current) });
  if (current.collection === 'users' && current.mustChangePassword === true && body.action !== 'change-password') {
    return result({ error: 'Change your temporary password before accessing the Control Room.' }, { status: 403 });
  }

  if (['membership-subscribers', 'membership-payments', 'update-subscriber', 'record-membership-payment'].includes(String(body.action))) {
    if (verifierUser(current)) return result({ error: 'Membership management requires admin access.' }, { status: 403 });
    if (body.action === 'update-subscriber' || body.action === 'record-membership-payment') {
      if (!Number.isSafeInteger(Number(body.id)) || Number(body.id) <= 0) return result({ error: 'Choose a valid subscriber.' }, { status: 400 });
      const matches = await payload.find({ collection: 'members', where: { id: { equals: body.id } }, limit: 1, overrideAccess: true });
      const member: any = matches.docs[0];
      if (!member || !['broker', 'agency', 'developer'].includes(member.accountType)) return result({ error: 'Subscriber not found.' }, { status: 404 });
      if (body.action === 'update-subscriber') {
        if (!['active', 'pending', 'past_due', 'suspended', 'cancelled'].includes(String(body.status))) return result({ error: 'Invalid membership status.' }, { status: 400 });
        await payload.update({ collection: 'members', id: member.id, data: { membershipStatus: body.status } as any, overrideAccess: true });
        return result({ ok: true });
      }
      if (!['paid', 'failed', 'pending'].includes(String(body.status)) || typeof body.reference !== 'string' || !body.reference.trim() || body.reference.length > 120 || typeof body.transactionDate !== 'string') return result({ error: 'Provide a reference, date and payment outcome.' }, { status: 400 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.transactionDate)) return result({ error: 'Choose a valid transaction date.' }, { status: 400 });
      const date = new Date(`${body.transactionDate}T00:00:00+05:30`);
      if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) return result({ error: 'Choose a valid transaction date that is not in the future.' }, { status: 400 });
      const price = member.membership?.price;
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return result({ error: 'This member does not have an agreed price. Confirm their membership rate before recording payments.' }, { status: 400 });
      try {
        await payload.create({ collection: 'membership-payments', overrideAccess: true, data: {
          reference: body.reference.trim(), member: member.id, subscriberName: member.name, subscriberEmail: member.email,
          plan: member.membership.plan, planName: member.membership.name, amount: price, currency: 'AED', status: body.status,
          transactionDate: date.toISOString(), recordedBy: String(current.email),
        } as any });
      } catch (error) {
        if ((error as any)?.status === 400 || (error as any)?.code === '23505' || (error as any)?.cause?.code === '23505') return result({ error: 'That payment reference already exists or is invalid.' }, { status: 400 });
        throw error;
      }
      return result({ ok: true });
    }
    if (body.action === 'membership-payments') {
      const payments = await payload.find({ collection: 'membership-payments', pagination: false, sort: '-transactionDate', depth: 0, overrideAccess: true });
      return result({ payments: payments.docs });
    }
    const members = await payload.find({ collection: 'members', where: { accountType: { in: ['broker', 'agency', 'developer'] } }, pagination: false, sort: '-createdAt', overrideAccess: true });
    return result({ subscribers: members.docs.map((member: any) => {
      const plan = planIdForAudience(member.plan, member.accountType);
      return { id: member.id, name: member.name, email: member.email, accountType: member.accountType, plan,
        planName: member.membership?.name || PLAN_CATALOG[plan]?.name || 'Unassigned', price: member.membership?.price ?? null,
        status: member.isSuspended ? 'suspended' : member.membershipStatus || 'pending', suspended: Boolean(member.isSuspended), createdAt: member.createdAt };
    }) });
  }

  if (body.action === 'membership-plans' || body.action === 'save-membership-plan') {
    if (verifierUser(current)) return result({ error: 'Membership management requires admin access.' }, { status: 403 });
    if (body.action === 'save-membership-plan') {
      const base = PLAN_CATALOG[String(body.slug)];
      if (!base) return result({ error: 'Choose a valid membership package.' }, { status: 400 });
      if (body.price !== null && (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0 || Math.abs(Math.round(body.price * 100) - body.price * 100) > 0.000001)) {
        return result({ error: 'Enter a valid price with at most two decimal places.' }, { status: 400 });
      }
      for (const field of ['seats', 'listings', 'selections']) {
        if (body[field] !== null && (!Number.isSafeInteger(body[field]) || body[field] < 0)) return result({ error: 'Limits must be non-negative whole numbers or blank for unlimited.' }, { status: 400 });
      }
      if (typeof body.audience !== 'string' || typeof body.features !== 'string' || body.features.length > 20000) return result({ error: 'Invalid package details.' }, { status: 400 });
      const data = { name: base.name, slug: base.id, roleAudience: base.roleAudience, sortOrder: base.sortOrder, price: body.price,
        seats: body.seats, listings: body.listings, selections: body.selections, audience: body.audience.trim(),
        features: body.features.split('\n').map((feature: string) => ({ feature: feature.trim() })).filter((item: any) => item.feature), highlighted: base.highlighted || false };
      const existing = await payload.find({ collection: 'plans', where: { slug: { equals: base.id } }, limit: 1, overrideAccess: true });
      if (existing.docs[0]) await payload.update({ collection: 'plans', id: existing.docs[0].id, data, overrideAccess: true });
      else await payload.create({ collection: 'plans', data, overrideAccess: true });
    }
    const saved = await payload.find({ collection: 'plans', limit: 100, overrideAccess: true });
    return result({ plans: Object.values(PLAN_CATALOG).map((base) => {
      const doc = saved.docs.find((item: any) => item.slug === base.id);
      return { ...base, ...doc, id: base.id, features: doc ? (doc.features || []).map((item: any) => item.feature).filter(Boolean) : base.features };
    }) });
  }

  if (body.action === 'change-password') {
    if (current.collection !== 'users' || !['subadmin', 'verifier'].includes(current.role)) {
      return result({ error: 'Only Control Room staff can use this password change.' }, { status: 403 });
    }
    if (typeof body.password !== 'string' || body.password.length < 12) {
      return result({ error: 'Your new password must be at least 12 characters.' }, { status: 400 });
    }
    await payload.update({
      collection: 'users',
      id: current.id,
      overrideAccess: true,
      data: { password: body.password, mustChangePassword: false } as any,
    });
    return result({ ok: true });
  }

  if (body.action === 'dashboard') {
    const [members, pendingMembers, properties, publishedProperties, enquiries, newEnquiries, brokers, media] =
      await Promise.all([
        payload.count({ collection: 'members', overrideAccess: true }),
        payload.count({
          collection: 'members',
          where: { and: [{ credentialStatus: { equals: 'pending' } }, { adminCreated: { not_equals: true } }] },
          overrideAccess: true,
        }),
        payload.count({ collection: 'properties', overrideAccess: true }),
        payload.count({ collection: 'properties', where: { status: { equals: 'published' } }, overrideAccess: true }),
        payload.count({ collection: 'enquiries', overrideAccess: true }),
        payload.count({ collection: 'enquiries', where: { status: { equals: 'new' } }, overrideAccess: true }),
        payload.count({ collection: 'brokers', overrideAccess: true }),
        payload.count({ collection: 'media', overrideAccess: true }),
      ]);
    const [memberList, propertyList, staffList] = await Promise.all([
      payload.find({ collection: 'members', overrideAccess: true, limit: 50, sort: '-createdAt', depth: 0 }),
      payload.find({ collection: 'properties', overrideAccess: true, limit: 50, sort: '-updatedAt', depth: 2 }),
      payload.find({
        collection: 'users',
        where: { role: { in: ['subadmin', 'verifier'] } },
        overrideAccess: true,
        limit: 50,
        sort: '-createdAt',
        depth: 0,
      }),
    ]);
    return result({
      stats: {
        members: members.totalDocs,
        pendingMembers: pendingMembers.totalDocs,
        properties: properties.totalDocs,
        publishedProperties: publishedProperties.totalDocs,
        enquiries: enquiries.totalDocs,
        newEnquiries: newEnquiries.totalDocs,
        brokers: brokers.totalDocs,
        media: media.totalDocs,
      },
      members: memberList.docs.map((member: any) => ({
        profile: member.profile || {},
        id: member.id,
        name: member.name,
        email: member.email,
        mobile: member.mobile || '',
        accountType: member.accountType,
        credentialStatus: member.credentialStatus || 'pending',
        adminCreated: member.adminCreated === true,
        adminAccess: member.adminAccess === true,
        isSuspended: member.isSuspended === true,
        controlRole:
          member.profile && typeof member.profile === 'object' && member.profile.controlRole === 'verifier'
            ? 'verifier'
            : member.adminCreated === true
              ? 'subadmin'
              : '',
        createdAt: member.createdAt,
      })),
      staff: staffList.docs.map((staff: any) => ({
        id: staff.id,
        name: staff.name || staff.email,
        email: staff.email,
        controlRole: staff.role,
        adminCreated: true,
        adminAccess: true,
        isSuspended: staff.isSuspended === true,
      })),
      properties: propertyList.docs.map((property: any) => ({
        id: property.id,
        title: property.title,
        ref: property.ref,
        status: property.status,
        purpose: property.purpose,
        area: property.area,
        price: property.price,
        visible: property.display?.visible !== false,
        updatedAt: property.updatedAt,
        verification: propertyVerification(property),
      })),
    });
  }

  if (body.action === 'update-member') {
    if (verifierUser(current)) {
      const hasAccessChange = Object.prototype.hasOwnProperty.call(body, 'adminAccess');
      if (hasAccessChange || body.credentialStatus == null || body.credentialReview == null) {
        return result({ error: 'Verifiers can only submit member verification decisions.' }, { status: 403 });
      }
    }
    if (body.id == null) return result({ error: 'Member id is required.' }, { status: 400 });
    const existingMember: any = await payload.findByID({ collection: 'members', id: body.id, overrideAccess: true });
    if (verifierUser(current) && existingMember.adminCreated === true) {
      return result({ error: 'Verifiers can only review public member accounts.' }, { status: 403 });
    }
    const data: Record<string, any> = {};
    if (
      typeof body.credentialStatus === 'string' &&
      ['pending', 'verified', 'rejected'].includes(body.credentialStatus)
    )
      data.credentialStatus = body.credentialStatus;
    if (typeof body.adminAccess === 'boolean') {
      if (body.adminAccess === true && existingMember.adminCreated !== true) {
        return result(
          { error: 'Only accounts created by an administrator can receive Control Room access.' },
          { status: 403 },
        );
      }
      data.adminAccess = body.adminAccess;
    }
    if (body.credentialReview && typeof body.credentialReview === 'object') {
      const review = body.credentialReview as Record<string, any>;
      const checks = review.checks && typeof review.checks === 'object' ? review.checks : {};
      const reason = typeof review.reason === 'string' ? review.reason.trim() : '';
      if (data.credentialStatus === 'rejected' && !reason) {
        return result({ error: 'A rejection reason is required.' }, { status: 400 });
      }
      const previousProfile =
        existingMember.profile && typeof existingMember.profile === 'object' ? existingMember.profile : {};
      data.profile = {
        ...previousProfile,
        credentialReview: {
          checks: Object.fromEntries(Object.entries(checks).map(([key, value]) => [key, value === true])),
          reason,
          status: data.credentialStatus || existingMember.credentialStatus || 'pending',
          reviewedAt: new Date().toISOString(),
        },
      };
    }
    if (!Object.keys(data).length) return result({ error: 'No valid member changes were supplied.' }, { status: 400 });
    const member = await payload.update({ collection: 'members', id: body.id, overrideAccess: true, data });
    return result({
      member: { id: member.id, credentialStatus: member.credentialStatus, adminAccess: member.adminAccess },
    });
  }

  if (body.action === 'account-action') {
    if (!['admin', 'subadmin'].includes(controlRole(current))) return result({ error: 'Only admins and subadmins can suspend or delete accounts.' }, { status: 403 });
    if (!['staff', 'member'].includes(String(body.kind)) || body.id == null) return result({ error: 'Select a valid account.' }, { status: 400 });
    const collection = body.kind === 'staff' ? 'users' : 'members';
    if (collection === 'users' && String(body.id) === String(current.id) && current.collection === 'users') return result({ error: 'You cannot suspend or delete your own admin account.' }, { status: 400 });
    const account: any = await payload.findByID({ collection, id: body.id, overrideAccess: true });
    if (collection === 'users' && !['subadmin', 'verifier'].includes(account.role)) return result({ error: 'Only subadmin and verifier accounts can be managed here.' }, { status: 400 });
    if (body.actionType === 'suspend' || body.actionType === 'unsuspend') {
      const updated = await payload.update({ collection, id: account.id, data: { isSuspended: body.actionType === 'suspend' }, overrideAccess: true });
      return result({ ok: true, isSuspended: updated.isSuspended === true });
    }
    if (body.actionType === 'delete') {
      try {
        if (collection === 'members') {
          const memberId = account.id;
          await payload.delete({ collection: 'member-state', where: { member: { equals: memberId } }, overrideAccess: true });
          await payload.delete({ collection: 'property-broker-claims', where: { or: [{ developer: { equals: memberId } }, { brokerMember: { equals: memberId } }] }, overrideAccess: true });
          await payload.delete({ collection: 'developer-subscriptions', where: { or: [{ developer: { equals: memberId } }, { broker: { equals: memberId } }] }, overrideAccess: true });
          await payload.delete({ collection: 'notifications', where: { recipient: { equals: memberId } }, overrideAccess: true });
          await payload.delete({ collection: 'agency-invitations', where: { invitedBy: { equals: memberId } }, overrideAccess: true });
        }
        await payload.delete({ collection, id: account.id, overrideAccess: true });
        return result({ ok: true });
      } catch (error) {
        console.error('[control-room] Account deletion failed:', error);
        return result({ error: 'Could not delete this account because related records still depend on it.' }, { status: 409 });
      }
    }
    return result({ error: 'Select suspend, unsuspend or delete.' }, { status: 400 });
  }

  if (body.action === 'create-member') {
    if (verifierUser(current)) return result({ error: 'Verifiers cannot create Control Room accounts.' }, { status: 403 });
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      typeof body.email !== 'string' ||
      !body.email.includes('@')
    ) {
      return result(
        { error: 'Name and a valid email are required.' },
        { status: 400 },
      );
    }
    if (!['subadmin', 'verifier'].includes(String(body.controlRole)))
      return result({ error: 'Select either Subadmin or Verifier.' }, { status: 400 });
    const temporaryPassword = generateTemporaryPassword();
    let member: any;
    try {
      member = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          name: body.name.trim(),
          email: body.email.trim().toLowerCase(),
          password: temporaryPassword,
          role: body.controlRole,
          mustChangePassword: true,
        } as any,
      });
      await sendNewMemberCredentials({
        to: member.email,
        name: member.name,
        temporaryPassword,
      });
      return result({ member: { id: member.id, name: member.name, email: member.email } }, { status: 201 });
    } catch (error) {
      console.error('[control-room] New member welcome email failed:', error instanceof Error ? error.message : error);
      if (member?.id != null) {
        try {
          await payload.delete({ collection: 'users', id: member.id, overrideAccess: true });
        } catch {
          // Preserve the original creation or delivery error.
        }
      }
      const message = error instanceof Error ? error.message : 'Could not create the member.';
      return result(
        {
          error: member?.id != null
            ? `The account could not be created because ${smtpFailureHint(error).toLowerCase()}`
            : /duplicate|already exists/i.test(message)
            ? 'An account with this email already exists.'
            : /SMTP|email configuration|server rejected/i.test(message)
              ? 'The account could not be created because the welcome email could not be sent. Check the email configuration.'
              : message,
        },
        { status: 400 },
      );
    }
  }

  if (body.action === 'update-property') {
    if (verifierUser(current) && !['approved', 'needs_changes'].includes(String(body.verificationDecision))) {
      return result({ error: 'Verifiers can only submit property verification decisions.' }, { status: 403 });
    }
    if (body.id == null) return result({ error: 'Property id is required.' }, { status: 400 });
    const existing: any = await payload.findByID({ collection: 'properties', id: body.id, overrideAccess: true });
    const data: Record<string, any> = {};
    if (body.verificationDecision === 'approved' || body.verificationDecision === 'needs_changes') {
      const verification = propertyVerification(existing);
      if (body.verificationDecision === 'approved' && !verification.ready)
        return result({ error: 'This property still has failed evidence checks.' }, { status: 400 });
      data.status = body.verificationDecision === 'approved' ? 'published' : 'pending';
    } else if (
      typeof body.status === 'string' &&
      ['draft', 'pending', 'published', 'unpublished', 'sold', 'rented', 'archived'].includes(body.status)
    )
      data.status = body.status;
    if (typeof body.visible === 'boolean') data.display = { ...(existing.display || {}), visible: body.visible };
    if (!Object.keys(data).length)
      return result({ error: 'No valid property changes were supplied.' }, { status: 400 });
    const property: any = await payload.update({ collection: 'properties', id: body.id, overrideAccess: true, data });
    return result({
      property: { id: property.id, status: property.status, visible: property.display?.visible !== false },
    });
  }

  return result({ error: 'Unsupported control room action.' }, { status: 400 });
}
