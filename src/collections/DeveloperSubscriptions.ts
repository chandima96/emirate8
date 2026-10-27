import type { CollectionConfig } from 'payload';

export const DeveloperSubscriptions: CollectionConfig = {
  slug: 'developer-subscriptions',
  admin: {
    useAsTitle: 'status',
    defaultColumns: ['developer', 'broker', 'status', 'createdAt'],
    group: 'Platform',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    create: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    update: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    delete: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
  },
  fields: [
    { name: 'developer', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'broker', type: 'relationship', relationTo: 'members', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      index: true,
    },
    { name: 'notifyNewListings', type: 'checkbox', defaultValue: true },
    { name: 'notifyUpdates', type: 'checkbox', defaultValue: true },
    { name: 'frequency', type: 'select', defaultValue: 'immediate', options: ['immediate', 'daily'] },
  ],
};
