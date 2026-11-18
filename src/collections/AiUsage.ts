import type { CollectionConfig } from 'payload';

/* One row per Claude API call: the ledger AI-credit balances are derived from (see src/lib/server/aiCredits.ts). */
export const AI_FEATURES = ['listing_autofill_fetch', 'listing_autofill_extract', 'listing_translate', 'profile_fetch', 'profile_extract'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AiUsage: CollectionConfig = {
  slug: 'ai-usage',
  admin: {
    useAsTitle: 'feature',
    group: 'Platform',
    defaultColumns: ['feature', 'member', 'credits', 'inputTokens', 'outputTokens', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user?.collection === 'users' && ['admin', 'subadmin'].includes(user.role)),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'member', type: 'relationship', relationTo: 'members', index: true, admin: { description: 'The seat that ran the AI action.' } },
    { name: 'pool', type: 'relationship', relationTo: 'members', index: true, admin: { description: 'The account whose credits were charged.' } },
    {
      name: 'feature',
      type: 'text',
      required: true,
      validate: (value: string) => (AI_FEATURES as readonly string[]).includes(value) || 'Invalid AI feature.',
    },
    { name: 'model', type: 'text' },
    { name: 'inputTokens', type: 'number', defaultValue: 0 },
    { name: 'outputTokens', type: 'number', defaultValue: 0 },
    { name: 'cacheCreationTokens', type: 'number', defaultValue: 0 },
    { name: 'cacheReadTokens', type: 'number', defaultValue: 0 },
    { name: 'webFetchRequests', type: 'number', defaultValue: 0 },
    { name: 'credits', type: 'number', required: true, defaultValue: 0 },
    { name: 'status', type: 'text', defaultValue: 'ok', validate: (value: string) => ['ok', 'error'].includes(value) || 'Invalid status.' },
    { name: 'requestId', type: 'text' },
  ],
};
