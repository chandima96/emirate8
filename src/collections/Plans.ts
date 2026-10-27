import type { CollectionConfig } from 'payload';
import { invalidateCmsCache } from '@/lib/payloadCacheHooks';

export const Plans: CollectionConfig = {
  slug: 'plans',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'seats', 'listings', 'price', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [invalidateCmsCache],
    afterDelete: [invalidateCmsCache],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'audience', type: 'text', label: 'Tagline / Audience' },
    { name: 'roleAudience', type: 'select', label: 'Account type', options: ['broker', 'agency', 'developer', 'buyer', 'platform'], defaultValue: 'platform' },
    { name: 'price', type: 'number', label: 'Monthly Price (AED)' },
    { name: 'seats', type: 'number', label: 'User Seats (null = unlimited)' },
    { name: 'listings', type: 'number', label: 'Active Listings Limit (null = unlimited)' },
    { name: 'selections', type: 'number', label: 'Network Selections Limit' },
    {
      name: 'features',
      type: 'array',
      label: 'Feature List',
      fields: [{ name: 'feature', type: 'text' }],
    },
    {
      name: 'highlighted',
      type: 'checkbox',
      label: 'Highlighted / Most Popular',
      defaultValue: false,
    },
    {
      name: 'sortOrder',
      type: 'number',
      label: 'Sort Order',
      defaultValue: 0,
    },
  ],
};
