import { NextResponse } from 'next/server';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/server/stripe';
import { fulfilCheckoutSession, syncSubscriptionStatus } from '@/lib/server/professionalCheckout';

export const runtime = 'nodejs';

/**
 * Stripe webhook. Completes professional upgrades even if the buyer closes the tab after paying, and
 * keeps the membership status in step with the subscription. Needs STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const payload = await getPayload({ config: await configPromise });
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const outcome = await fulfilCheckoutSession(payload, event.data.object);
      if (!outcome.ok && !('pending' in outcome)) console.error('[stripe] Could not fulfil checkout:', outcome.error);
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscriptionStatus(payload, event.data.object);
      break;
  }
  return NextResponse.json({ received: true });
}
