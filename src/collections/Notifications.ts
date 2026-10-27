import type { CollectionConfig } from 'payload';

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['recipient', 'type', 'title', 'read', 'createdAt'],
    group: 'Platform',
  },
  access: {
    read: ({ req: { user } }) => (user ? { recipient: { equals: user.id } } : false),
    create: () => false,
    update: ({ req: { user } }) => (user ? { recipient: { equals: user.id } } : false),
    delete: ({ req: { user } }) => (user ? { recipient: { equals: user.id } } : false),
  },
  fields: [
    { name: 'recipient', type: 'relationship', relationTo: 'members', required: true, index: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        'developer_property_published',
        'developer_property_updated',
        'claim_request',
        'claim_decision',
        'primary_broker_assigned',
        'subscription',
        'general',
      ],
    },
    { name: 'title', type: 'text', required: true },
    { name: 'message', type: 'textarea' },
    { name: 'property', type: 'relationship', relationTo: 'properties' },
    { name: 'developer', type: 'relationship', relationTo: 'members' },
    { name: 'claim', type: 'relationship', relationTo: 'property-broker-claims' },
    { name: 'read', type: 'checkbox', defaultValue: false, index: true },
    { name: 'delivery', type: 'select', defaultValue: 'in_app', options: ['in_app', 'queued', 'sent', 'failed'] },
    { name: 'deliveryError', type: 'text' },
    { name: 'eventKey', type: 'text', index: true },
  ],
};
