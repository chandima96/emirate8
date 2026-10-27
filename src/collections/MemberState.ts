import type { CollectionConfig } from 'payload';

export const MemberState: CollectionConfig = {
  slug: 'member-state',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'member', 'updatedAt'],
    group: 'Platform',
  },
  access: {
    read: ({ req: { user } }) => (user ? { member: { equals: user.id } } : false),
    create: () => false,
    update: ({ req: { user } }) => (user ? { member: { equals: user.id } } : false),
    delete: ({ req: { user } }) => (user ? { member: { equals: user.id } } : false),
  },
  fields: [
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'members',
      required: true,
      index: true,
    },
    { name: 'key', type: 'text', required: true, index: true },
    { name: 'state', type: 'json', required: true },
  ],
};
