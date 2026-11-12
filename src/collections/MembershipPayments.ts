import type { CollectionConfig } from 'payload';

export const MembershipPayments: CollectionConfig = {
  slug: 'membership-payments',
  admin: {
    useAsTitle: 'reference',
    group: 'Platform',
    defaultColumns: ['reference', 'subscriberName', 'amount', 'status', 'transactionDate'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user?.collection === 'users' && ['admin', 'subadmin'].includes(user.role)),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true },
    { name: 'member', type: 'relationship', relationTo: 'members', index: true },
    { name: 'subscriberName', type: 'text', required: true },
    { name: 'subscriberEmail', type: 'text', required: true },
    { name: 'plan', type: 'text', required: true },
    { name: 'planName', type: 'text', required: true },
    { name: 'amount', type: 'number', required: true, min: 0 },
    { name: 'currency', type: 'text', required: true, defaultValue: 'AED' },
    {
      name: 'status',
      type: 'text',
      required: true,
      validate: (value: string) => ['paid', 'failed', 'pending'].includes(value) || 'Invalid payment status.',
    },
    { name: 'transactionDate', type: 'date', required: true },
    { name: 'recordedBy', type: 'text', required: true },
  ],
};
