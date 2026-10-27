import type { CollectionConfig } from 'payload';

export const WaitlistSignups: CollectionConfig = {
  slug: 'waitlist-signups',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'source', 'createdAt'],
  },
  access: {
    create: () => true,
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'name', type: 'text' },
    { name: 'phone', type: 'text' },
    {
      name: 'role',
      type: 'select',
      label: 'Role / Interest',
      options: [
        { label: 'Property Owner', value: 'owner' },
        { label: 'Broker', value: 'broker' },
        { label: 'Buyer / Tenant', value: 'buyer' },
        { label: 'Investor', value: 'investor' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      label: 'Signup Source',
      options: [
        { label: 'Homepage', value: 'homepage' },
        { label: 'Sell Page', value: 'sell' },
        { label: 'Register Page', value: 'register' },
        { label: 'Other', value: 'other' },
      ],
      defaultValue: 'homepage',
    },
    { name: 'message', type: 'textarea', label: 'Message / Notes' },
    {
      name: 'contacted',
      type: 'checkbox',
      label: 'Contacted',
      defaultValue: false,
    },
  ],
};
