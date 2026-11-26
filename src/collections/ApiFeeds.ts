import type { CollectionConfig } from 'payload';

/*
 * Property feed API access for independent brokers (src/lib/server/propertyFeed.ts).
 * One row per member: the hashed API key and which published properties the feed carries.
 * The feed is an exclusion list by default, so newly published properties join it automatically.
 * Members manage it through /api/property-feed; the key itself is never stored, only its SHA-256 hash.
 */
const staffOnly = ({ req: { user } }) => Boolean(user?.collection === 'users' && ['admin', 'subadmin'].includes(user.role));

export const ApiFeeds: CollectionConfig = {
  slug: 'api-feeds',
  admin: {
    useAsTitle: 'keyPrefix',
    group: 'Platform',
    defaultColumns: ['member', 'keyPrefix', 'autoIncludeNew', 'lastUsedAt', 'requestCount'],
  },
  access: {
    read: staffOnly,
    create: () => false,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    { name: 'member', type: 'relationship', relationTo: 'members', required: true, unique: true, index: true },
    { name: 'keyHash', type: 'text', index: true, admin: { hidden: true } },
    { name: 'keyPrefix', type: 'text', admin: { readOnly: true, description: 'Identifies the key without revealing it.' } },
    { name: 'keyCreatedAt', type: 'date', admin: { readOnly: true } },
    { name: 'lastUsedAt', type: 'date', admin: { readOnly: true } },
    { name: 'requestCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    {
      name: 'autoIncludeNew',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'On: every published property except `excluded`. Off: only the `included` properties.' },
    },
    { name: 'excluded', type: 'json', admin: { description: 'Listing IDs removed from the feed (used when autoIncludeNew is on).' } },
    { name: 'included', type: 'json', admin: { description: 'Listing IDs in the feed (used when autoIncludeNew is off).' } },
  ],
};
