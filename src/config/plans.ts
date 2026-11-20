export type AccountPlanAudience = 'broker' | 'agency' | 'developer';

export type AccountPlan = {
  id: string;
  name: 'Bronze' | 'Silver' | 'Gold';
  roleAudience: AccountPlanAudience;
  audience: string;
  price: null;
  seats: number | null;
  listings: number | null;
  selections: number;
  /** Monthly AI credits for the account (shared by every seat). */
  aiCredits: number;
  sortOrder: number;
  highlighted?: boolean;
  features: string[];
};

export const PLAN_CATALOG: Record<string, AccountPlan> = {
  'broker-bronze': {
    id: 'broker-bronze', name: 'Bronze', roleAudience: 'broker', audience: 'For independent brokers getting started.',
    price: null, seats: 1, listings: 25, aiCredits: 1000, selections: 50, sortOrder: 1,
    features: ['1 user seat', '25 active listings', '50 network selections', 'Public broker profile', 'Broker network access', '1,000 AI credits / month'],
  },
  'broker-silver': {
    id: 'broker-silver', name: 'Silver', roleAudience: 'broker', audience: 'For active brokers growing their portfolio.',
    price: null, seats: 1, listings: 100, aiCredits: 3000, selections: 300, sortOrder: 2, highlighted: true,
    features: ['1 user seat', '100 active listings', '300 network selections', 'Enhanced broker profile', 'Broker network access', 'Priority listing support', '3,000 AI credits / month'],
  },
  'broker-gold': {
    id: 'broker-gold', name: 'Gold', roleAudience: 'broker', audience: 'For established brokers with larger portfolios.',
    price: null, seats: 1, listings: 250, aiCredits: 8000, selections: 1000, sortOrder: 3,
    features: ['1 user seat', '250 active listings', '1,000 network selections', 'Featured broker profile', 'Broker network access', 'Priority support', '8,000 AI credits / month'],
  },
  'agency-bronze': {
    id: 'agency-bronze', name: 'Bronze', roleAudience: 'agency', audience: 'For small agency teams.',
    price: null, seats: 3, listings: 50, aiCredits: 3000, selections: 150, sortOrder: 1,
    features: ['Up to 3 team seats', '50 active listings', '150 network selections', 'Agency profile', 'Team invitations', '3,000 AI credits / month'],
  },
  'agency-silver': {
    id: 'agency-silver', name: 'Silver', roleAudience: 'agency', audience: 'For growing real estate agencies.',
    price: null, seats: 5, listings: 100, aiCredits: 8000, selections: 300, sortOrder: 2, highlighted: true,
    features: ['Up to 5 team seats', '100 active listings', '300 network selections', 'Agency profile', 'Team invitations', 'Shared listing management', '8,000 AI credits / month'],
  },
  'agency-gold': {
    id: 'agency-gold', name: 'Gold', roleAudience: 'agency', audience: 'For established agencies with larger teams.',
    price: null, seats: null, listings: null, aiCredits: 25000, selections: 2000, sortOrder: 3,
    features: ['Configurable team seats', 'Flexible active listings', '2,000 network selections', 'Agency profile', 'Team invitations', 'Expanded management tools', 'Priority support', '25,000 AI credits / month'],
  },
  'developer-bronze': {
    id: 'developer-bronze', name: 'Bronze', roleAudience: 'developer', audience: 'For developers publishing initial inventory.',
    price: null, seats: 3, listings: 100, aiCredits: 3000, selections: 0, sortOrder: 1,
    features: ['3 team seats', '100 active properties', 'Primary broker assignment', 'Owner-direct listings', 'Broker claim requests', '3,000 AI credits / month'],
  },
  'developer-silver': {
    id: 'developer-silver', name: 'Silver', roleAudience: 'developer', audience: 'For developers with growing project inventory.',
    price: null, seats: 5, listings: 250, aiCredits: 8000, selections: 0, sortOrder: 2, highlighted: true,
    features: ['5 team seats', '250 active properties', 'Primary broker assignment', 'Owner-direct listings', 'Broker claim requests', 'Broker notifications', '8,000 AI credits / month'],
  },
  'developer-gold': {
    id: 'developer-gold', name: 'Gold', roleAudience: 'developer', audience: 'For developers with extensive portfolios.',
    price: null, seats: null, listings: null, aiCredits: 25000, selections: 0, sortOrder: 3,
    features: ['Configurable team seats', 'Flexible active properties', 'Primary broker assignment', 'Owner-direct listings', 'Broker claim requests', 'Broker notifications', 'Priority support', '25,000 AI credits / month'],
  },
};

const LEGACY_PLAN_IDS: Record<string, Record<string, string>> = {
  broker: { starter: 'broker-bronze' },
  agency: { team: 'agency-silver', enterprise: 'agency-gold' },
  developer: { developer: 'developer-bronze' },
};

export function planIdForAudience(planId: string | undefined, audience: AccountPlanAudience) {
  if (planId && PLAN_CATALOG[planId]?.roleAudience === audience) return planId;
  return LEGACY_PLAN_IDS[audience][planId || ''] || `${audience}-bronze`;
}

/*
 * Demo prices (AED / month) for trying Stripe test-mode Checkout before real prices are set in the
 * Plans collection. Only used when NEXT_PUBLIC_STRIPE_DEMO_PRICES=true and the plan has no price.
 */
const DEMO_PLAN_PRICES: Record<AccountPlan['name'], number> = { Bronze: 99, Silver: 249, Gold: 499 };

export function demoPlanPrice(planId: string): number | null {
  if (process.env.NEXT_PUBLIC_STRIPE_DEMO_PRICES !== 'true') return null;
  const plan = PLAN_CATALOG[planId];
  return plan ? DEMO_PLAN_PRICES[plan.name] : null;
}
