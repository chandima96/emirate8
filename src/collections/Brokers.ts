import type { CollectionConfig } from 'payload';
import { invalidateCmsCache } from '@/lib/payloadCacheHooks';

export const Brokers: CollectionConfig = {
  slug: 'brokers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'reraNumber', 'agency', 'verified', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [invalidateCmsCache],
    afterDelete: [invalidateCmsCache],
  },
  fields: [
    { name: 'appData', type: 'json', admin: { hidden: true } },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Full Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly identifier (e.g. "sara-al-mansoori")',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Profile Photo',
    },
    {
      name: 'reraNumber',
      type: 'text',
      label: 'RERA Number',
    },
    {
      name: 'agency',
      type: 'relationship',
      relationTo: 'agencies',
      label: 'Agency',
    },
    {
      name: 'agencyLabel',
      type: 'text',
      label: 'Agency Display Name (override)',
    },
    {
      name: 'title',
      type: 'text',
      label: 'Job Title',
      defaultValue: 'Real Estate Broker',
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'About',
    },
    {
      name: 'specialties',
      type: 'array',
      label: 'Specialties',
      fields: [{ name: 'specialty', type: 'text' }],
    },
    {
      name: 'languages',
      type: 'array',
      label: 'Languages',
      fields: [{ name: 'language', type: 'text' }],
    },
    {
      name: 'location',
      type: 'text',
      label: 'Location',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'whatsapp',
      type: 'text',
      label: 'WhatsApp Number',
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'social',
      type: 'group',
      label: 'Social Media',
      fields: [
        { name: 'instagram', type: 'text' },
        { name: 'linkedin', type: 'text' },
      ],
    },
    {
      name: 'stats',
      type: 'group',
      label: 'Stats',
      fields: [
        { name: 'listingCount', type: 'number', defaultValue: 0 },
        { name: 'soldCount', type: 'number', defaultValue: 0 },
        { name: 'yearsExperience', type: 'number', defaultValue: 0 },
        { name: 'rating', type: 'number', defaultValue: 0 },
        { name: 'reviewCount', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'verified',
      type: 'checkbox',
      label: 'RERA Verified',
      defaultValue: false,
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Featured Broker',
      defaultValue: false,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Broker', value: 'broker' },
        { label: 'Buyer / Owner', value: 'buyer' },
      ],
      defaultValue: 'broker',
    },
  ],
};
