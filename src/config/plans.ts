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
  sortOrder: number;
  highlighted?: boolean;
  features: string[];
};

export const PLAN_CATALOG: Record<string, AccountPlan> = {
  'broker-bronze': {
    id: 'broker-bronze', name: 'Bronze', roleAudience: 'broker', audience: 'For independent brokers getting started.',
    price: null, seats: 1, listings: 25, selections: 50, sortOrder: 1,
    features: ['1 user seat', '25 active listings', '50 network selections', 'Public broker profile', 'Broker network access'],
  },
  'broker-silver': {
    id: 'broker-silver', name: 'Silver', roleAudience: 'broker', audience: 'For active brokers growing their portfolio.',
    price: null, seats: 1, listings: 100, selections: 300, sortOrder: 2, highlighted: true,
    features: ['1 user seat', '100 active listings', '300 network selections', 'Enhanced broker profile', 'Broker network access', 'Priority listing support'],
  },
  'broker-gold': {
    id: 'broker-gold', name: 'Gold', roleAudience: 'broker', audience: 'For established brokers with larger portfolios.',
    price: null, seats: 1, listings: 250, selections: 1000, sortOrder: 3,
    features: ['1 user seat', '250 active listings', '1,000 network selections', 'Featured broker profile', 'Broker network access', 'Priority support'],
  },
  'agency-bronze': {
    id: 'agency-bronze', name: 'Bronze', roleAudience: 'agency', audience: 'For small agency teams.',
    price: null, seats: 3, listings: 50, selections: 150, sortOrder: 1,
    features: ['Up to 3 team seats', '50 active listings', '150 network selections', 'Agency profile', 'Team invitations'],
  },
  'agency-silver': {
    id: 'agency-silver', name: 'Silver', roleAudience: 'agency', audience: 'For growing real estate agencies.',
    price: null, seats: 5, listings: 100, selections: 300, sortOrder: 2, highlighted: true,
    features: ['Up to 5 team seats', '100 active listings', '300 network selections', 'Agency profile', 'Team invitations', 'Shared listing management'],
  },
  'agency-gold': {
    id: 'agency-gold', name: 'Gold', roleAudience: 'agency', audience: 'For established agencies with larger teams.',
    price: null, seats: null, listings: null, selections: 2000, sortOrder: 3,
    features: ['Configurable team seats', 'Flexible active listings', '2,000 network selections', 'Agency profile', 'Team invitations', 'Expanded management tools', 'Priority support'],
  },
  'developer-bronze': {
    id: 'developer-bronze', name: 'Bronze', roleAudience: 'developer', audience: 'For developers publishing initial inventory.',
    price: null, seats: 3, listings: 100, selections: 0, sortOrder: 1,
    features: ['3 team seats', '100 active properties', 'Primary broker assignment', 'Owner-direct listings', 'Broker claim requests'],
  },
  'developer-silver': {
    id: 'developer-silver', name: 'Silver', roleAudience: 'developer', audience: 'For developers with growing project inventory.',
    price: null, seats: 5, listings: 250, selections: 0, sortOrder: 2, highlighted: true,
    features: ['5 team seats', '250 active properties', 'Primary broker assignment', 'Owner-direct listings', 'Broker claim requests', 'Broker notifications'],
  },
  'developer-gold': {
    id: 'developer-gold', name: 'Gold', roleAudience: 'developer', audience: 'For developers with extensive portfolios.',
    price: null, seats: null, listings: null, selections: 0, sortOrder: 3,
    features: ['Configurable team seats', 'Flexible active properties', 'Primary broker assignment', 'Owner-direct listings', 'Broker claim requests', 'Broker notifications', 'Priority support'],
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
