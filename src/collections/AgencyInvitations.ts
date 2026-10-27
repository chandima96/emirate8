import type { CollectionConfig } from 'payload';

export const AgencyInvitations: CollectionConfig = {
  slug: 'agency-invitations',
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'agency', 'role', 'status', 'createdAt'], group: 'Platform' },
  access: {
    read: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    create: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    update: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
    delete: ({ req: { user } }) => Boolean(user && user.collection === 'users' && user.role === 'admin'),
  },
  fields: [
    { name: 'agency', type: 'relationship', relationTo: 'agencies', required: true, index: true },
    { name: 'invitedBy', type: 'relationship', relationTo: 'members', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'name', type: 'text' },
    { name: 'role', type: 'select', defaultValue: 'agency_broker', options: ['agency_manager', 'agency_broker', 'agency_viewer'] },
    { name: 'status', type: 'select', defaultValue: 'pending', options: ['pending', 'accepted', 'declined', 'cancelled'] },
    { name: 'token', type: 'text', required: true, unique: true },
    { name: 'expiresAt', type: 'date' },
  ],
};
