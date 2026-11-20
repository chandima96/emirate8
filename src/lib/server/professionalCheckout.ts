import 'server-only';
import configPromise from '@payload-config';
import { getPayload, type Payload } from 'payload';
import type Stripe from 'stripe';
import { PLAN_CATALOG, demoPlanPrice } from '@/config/plans';
import { result, isRecord } from './result';
import { getStripe } from './stripe';
import { isEmailVerified } from './emailVerification';
import { professionalWelcomeEmail } from './emailTemplates';
import {
  applyProfessionalUpgrade,
  readProfessionalUpgrade,
  toAppUser,
  type ProfessionalUpgrade,
} from './session';

/*
 * Paying for a professional membership with Stripe Checkout.
 *
 *   start    → the professional details are saved on the member as `profile.pendingUpgrade` and a
 *              Stripe Checkout subscription is opened for the plan's monthly AED price.
 *   complete → when Stripe reports the session paid (return URL or webhook, whichever is first) the
 *              pending upgrade is applied, the payment is recorded and a welcome email is sent.
 *
 * Plans without a price set in the Plans collection need no payment and upgrade straight away; the
 * membership stays `pending` for the team to arrange billing.
 */
const LABEL = { broker: 'Licensed Broker', agency: 'Real Estate Agency', developer: 'Property Developer' };

function siteUrl(requestHeaders: Headers) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || 'localhost:3000';
  const proto = requestHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function signedInMember(requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  if (!user || user.collection !== 'members') return { payload, member: null };
  const member = (await payload.findByID({ collection: 'members', id: user.id, overrideAccess: true })) as Record<string, any>;
  return { payload, member };
}

async function planDetails(payload: Payload, planId: string) {
  const found = await payload.find({ collection: 'plans', where: { slug: { equals: planId } }, limit: 1, depth: 0, overrideAccess: true });
  const doc = found.docs[0] as Record<string, any> | undefined;
  const price = typeof doc?.price === 'number' && doc.price > 0 ? doc.price : demoPlanPrice(planId);
  return { name: String(doc?.name || PLAN_CATALOG[planId]?.name || 'Membership'), price };
}

async function sendWelcome(payload: Payload, member: Record<string, any>, upgrade: ProfessionalUpgrade, amount: number | null) {
  const plan = await planDetails(payload, upgrade.plan);
  try {
    await payload.sendEmail({
      to: member.email,
      ...professionalWelcomeEmail({ name: member.name, accountLabel: LABEL[upgrade.type], planName: plan.name, amount }),
    });
  } catch (error) {
    console.error('[pro-checkout] Could not send welcome email:', error);
  }
}

/** Saves the professional details and opens Stripe Checkout (or upgrades directly for unpriced plans). */
export async function startProfessionalCheckout(body: unknown, requestHeaders: Headers) {
  const { payload, member } = await signedInMember(requestHeaders);
  if (!member) return result({ error: 'Sign in to continue.' }, { status: 401 });
  if (member.accountType !== 'buyer') return result({ error: 'This account is already a professional account.' }, { status: 409 });
  if (!isEmailVerified(member)) return result({ error: 'Confirm your email address before upgrading.', field: 'email' }, { status: 403 });

  const upgrade = readProfessionalUpgrade(body, member.name);
  if ('error' in upgrade) return result({ error: upgrade.error }, { status: 400 });
  const plan = await planDetails(payload, upgrade.plan);

  if (!plan.price) {
    const updated = await applyProfessionalUpgrade(payload, member, upgrade);
    await sendWelcome(payload, updated, upgrade, null);
    return result({ user: toAppUser(updated) });
  }

  const stripe = getStripe();
  if (!stripe) return result({ error: 'Online payments are not available right now. Please try again later.' }, { status: 503 });

  const site = siteUrl(requestHeaders);
  // With a publishable key the payment form is embedded in our page; otherwise fall back to Stripe's hosted page.
  const embedded = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const metadata = { memberId: String(member.id), accountType: upgrade.type, plan: upgrade.plan };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: String(member.id),
    customer_email: member.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'aed',
          unit_amount: Math.round(plan.price * 100),
          recurring: { interval: 'month' },
          product_data: { name: `Emirate08 ${plan.name} — ${LABEL[upgrade.type]}` },
        },
      },
    ],
    metadata,
    subscription_data: { metadata },
    ...(embedded
      ? { ui_mode: 'embedded_page' as const, redirect_on_completion: 'never' as const }
      : {
          success_url: `${site}/register/professional?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${site}/register/professional?checkout=cancelled`,
        }),
  });

  const profile = member.profile && typeof member.profile === 'object' ? member.profile : {};
  await payload.update({
    collection: 'members',
    id: member.id,
    overrideAccess: true,
    data: {
      profile: { ...profile, pendingUpgrade: { ...upgrade, sessionId: session.id, price: plan.price, createdAt: new Date().toISOString() } },
    },
  });
  return embedded
    ? result({ clientSecret: session.client_secret, sessionId: session.id })
    : result({ url: session.url });
}

/**
 * Applies a paid Checkout session. Safe to call more than once (return URL and webhook): the payment
 * record, keyed by the session id, is created first and acts as the lock.
 */
export async function fulfilCheckoutSession(payload: Payload, session: Stripe.Checkout.Session) {
  if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) {
    return { ok: false as const, pending: true as const };
  }
  const memberId = session.metadata?.memberId || session.client_reference_id;
  if (!memberId) return { ok: false as const, error: 'This payment is not linked to an account.' };
  const member = (await payload.findByID({ collection: 'members', id: memberId, overrideAccess: true }).catch(() => null)) as Record<string, any> | null;
  if (!member) return { ok: false as const, error: 'Account not found.' };

  const pending = member.profile?.pendingUpgrade;
  if (member.accountType !== 'buyer') return { ok: true as const, member };
  if (!isRecord(pending) || pending.sessionId !== session.id) {
    return { ok: false as const, error: 'This payment does not match your professional details. Please contact support.' };
  }

  const amount = (session.amount_total ?? 0) / 100;
  try {
    await payload.create({
      collection: 'membership-payments',
      overrideAccess: true,
      data: {
        reference: session.id,
        member: member.id,
        subscriberName: member.name,
        subscriberEmail: member.email,
        plan: pending.plan,
        planName: (await planDetails(payload, pending.plan)).name,
        amount,
        currency: (session.currency || 'aed').toUpperCase(),
        status: 'paid',
        transactionDate: new Date().toISOString(),
        recordedBy: 'stripe',
      } as any,
    });
  } catch {
    // Already recorded: another request is applying (or has applied) this payment.
    const latest = (await payload.findByID({ collection: 'members', id: member.id, overrideAccess: true })) as Record<string, any>;
    return latest.accountType === 'buyer' ? { ok: false as const, pending: true as const } : { ok: true as const, member: latest };
  }

  const upgrade = { type: pending.type, plan: pending.plan, credentials: pending.credentials || {} } as ProfessionalUpgrade;
  const updated = await applyProfessionalUpgrade(payload, member, upgrade, {
    membershipStatus: 'active',
    profile: {
      billing: {
        provider: 'stripe',
        customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null,
        checkoutSessionId: session.id,
      },
    },
  });
  await sendWelcome(payload, updated, upgrade, amount);
  return { ok: true as const, member: updated };
}

/** Called on the Stripe return URL: confirms the session belongs to the signed-in member and applies it. */
export async function completeProfessionalCheckout(sessionId: unknown, requestHeaders: Headers) {
  const { payload, member } = await signedInMember(requestHeaders);
  if (!member) return result({ error: 'Sign in to continue.' }, { status: 401 });
  if (member.accountType !== 'buyer') return result({ user: toAppUser(member) });

  const id = typeof sessionId === 'string' && sessionId.startsWith('cs_') ? sessionId : member.profile?.pendingUpgrade?.sessionId;
  if (!id) return result({ error: 'No payment to confirm.' }, { status: 404 });
  const stripe = getStripe();
  if (!stripe) return result({ error: 'Online payments are not available right now.' }, { status: 503 });

  const session = await stripe.checkout.sessions.retrieve(id);
  if (String(session.client_reference_id) !== String(member.id)) {
    return result({ error: 'This payment belongs to a different account.' }, { status: 403 });
  }
  const outcome = await fulfilCheckoutSession(payload, session);
  if (!outcome.ok) {
    return 'pending' in outcome
      ? result({ pending: true, error: 'Your payment is still processing. This page will update once it completes.' }, { status: 202 })
      : result({ error: outcome.error }, { status: 400 });
  }
  return result({ user: toAppUser(outcome.member) });
}

/** Keeps the membership status in step with the Stripe subscription after sign-up. */
export async function syncSubscriptionStatus(payload: Payload, subscription: Stripe.Subscription) {
  const memberId = subscription.metadata?.memberId;
  if (!memberId) return;
  const status =
    subscription.status === 'active' || subscription.status === 'trialing'
      ? 'active'
      : subscription.status === 'past_due' || subscription.status === 'unpaid'
        ? 'past_due'
        : subscription.status === 'canceled' || subscription.status === 'incomplete_expired'
          ? 'cancelled'
          : null;
  if (!status) return;
  await payload
    .update({ collection: 'members', id: memberId, overrideAccess: true, data: { membershipStatus: status } as any })
    .catch((error) => console.error('[stripe] Could not update membership status:', error));
}
