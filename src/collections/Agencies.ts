import type { CollectionConfig } from 'payload';
import { invalidateCmsCache } from '@/lib/payloadCacheHooks';

export const Agencies: CollectionConfig = {
  slug: 'agencies',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'licenseNumber', 'location', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [invalidateCmsCache],
    afterDelete: [invalidateCmsCache],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Agency Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly identifier (e.g. "elite-realty")',
      },
    },
    {
      name: 'licenseNumber',
      type: 'text',
      label: 'RERA License Number',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Agency Logo',
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Cover Image',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'About',
    },
    {
      name: 'location',
      type: 'text',
      label: 'Office Location',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'website',
      type: 'text',
    },
    {
      name: 'social',
      type: 'group',
      label: 'Social Media',
      fields: [
        { name: 'instagram', type: 'text' },
        { name: 'linkedin', type: 'text' },
        { name: 'facebook', type: 'text' },
      ],
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Featured Agency',
      defaultValue: false,
    },
    {
      name: 'verified',
      type: 'checkbox',
      label: 'Verified',
      defaultValue: false,
    },
  ],
};
