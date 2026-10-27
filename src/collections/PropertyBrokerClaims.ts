import type { CollectionConfig } from 'payload';

export const PropertyBrokerClaims: CollectionConfig = {
  slug: 'property-broker-claims',
  admin: {
    useAsTitle: 'status',
    defaultColumns: ['property', 'brokerMember', 'status', 'createdAt'],
    group: 'Platform',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    create: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    update: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    delete: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
  },
  fields: [
    { name: 'property', type: 'relationship', relationTo: 'properties', required: true, index: true },
    { name: 'developer', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'brokerMember', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'broker', type: 'relationship', relationTo: 'brokers' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Withdrawn', value: 'withdrawn' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      index: true,
    },
    { name: 'message', type: 'textarea' },
    { name: 'decisionReason', type: 'textarea' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'members' },
    { name: 'reviewedAt', type: 'date' },
  ],
};
