import type { CollectionConfig } from 'payload';

export const Members: CollectionConfig = {
  slug: 'members',
  auth: {
    useAPIKey: false,
    tokenExpiration: 60 * 60 * 24 * 30,
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'accountType', 'credentialStatus', 'createdAt'],
    group: 'Platform',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.collection === 'users' && user.role === 'admin') return true;
      return user.collection === 'members' ? { id: { equals: user.id } } : false;
    },
    create: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    update: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    delete: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (req.user?.collection === 'users' && req.user.role === 'admin') {
          return { ...data, adminCreated: true, adminAccess: true };
        }
        return data;
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'accountType', type: 'select', required: true, options: [
      { label: 'Broker', value: 'broker' },
      { label: 'Agency', value: 'agency' },
      { label: 'Buyer', value: 'buyer' },
      { label: 'Developer', value: 'developer' },
    ] },
    { name: 'mobile', type: 'text' },
    { name: 'profile', type: 'json' },
    { name: 'credentialStatus', type: 'select', defaultValue: 'pending', options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Verified', value: 'verified' },
      { label: 'Rejected', value: 'rejected' },
    ] },
    { name: 'plan', type: 'text', defaultValue: 'starter' },
    { name: 'mustChangePassword', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
    { name: 'isSuspended', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
    {
      name: 'adminCreated',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
    {
      name: 'adminAccess',
      type: 'checkbox',
      defaultValue: false,
      label: 'Control Room access',
      admin: { description: 'Only admin-created members should have access.' },
    },
  ],
};
