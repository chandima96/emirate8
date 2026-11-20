import 'server-only';
import Stripe from 'stripe';

let client: Stripe | null = null;

/** The Stripe client, or null when STRIPE_SECRET_KEY is not set. Use a `sk_test_…` key for the sandbox. */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}
