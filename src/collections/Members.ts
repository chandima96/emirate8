import type { CollectionConfig } from 'payload';
import { PLAN_CATALOG, planIdForAudience } from '@/config/plans';

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
      async ({ data, originalDoc, req, operation }) => {
        const audience = data.accountType || originalDoc?.accountType;
        if (!['broker', 'agency', 'developer'].includes(audience)) return data;
        const plan = planIdForAudience(data.plan || originalDoc?.plan, audience);
        if (operation === 'create' || plan !== planIdForAudience(originalDoc?.plan, audience)) {
          const found = await req.payload.find({ collection: 'plans', where: { slug: { equals: plan } }, limit: 1, overrideAccess: true, req });
          const current = found.docs[0] || PLAN_CATALOG[plan];
          data.membership = { plan, name: current.name, price: current.price ?? null, currency: 'AED', interval: 'month', agreedAt: new Date().toISOString() };
        } else {
          // The agreed price is server-owned and survives catalogue changes.
          data.membership = originalDoc?.membership;
        }
        data.plan = plan;
        return data;
      },
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
    { name: 'membershipStatus', type: 'text', defaultValue: 'pending', access: { create: () => false, update: () => false }, admin: { readOnly: true } },
    { name: 'membership', type: 'json', admin: { readOnly: true, description: 'Agreed membership price, preserved when catalogue prices change.' }, access: { create: () => false, update: () => false } },
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
