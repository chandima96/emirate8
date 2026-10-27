import type { CollectionConfig } from 'payload';

export const AmenityDefinitions: CollectionConfig = {
  slug: 'amenity-definitions',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['category', 'label', 'inputType', 'active', 'sortOrder'],
    group: 'Platform',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
    update: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
    delete: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
  },
  fields: [
    { name: 'category', type: 'text', required: true, index: true },
    { name: 'key', type: 'text', required: true },
    { name: 'label', type: 'text', required: true },
    {
      name: 'inputType',
      type: 'select',
      defaultValue: 'boolean',
      options: ['boolean', 'text', 'number', 'select', 'multi_select'],
    },
    { name: 'options', type: 'json' },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'searchable', type: 'checkbox', defaultValue: false },
    { name: 'public', type: 'checkbox', defaultValue: true },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
};
