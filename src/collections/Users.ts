import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Full Name',
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Subadmin', value: 'subadmin' },
        { label: 'Verifier', value: 'verifier' },
      ],
      defaultValue: 'subadmin',
      required: true,
    },
    {
      name: 'mustChangePassword',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
    { name: 'isSuspended', type: 'checkbox', defaultValue: false, label: 'Suspended' },
  ],
};
