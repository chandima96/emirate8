import type { CollectionConfig } from 'payload';
import { bundledMediaURL, getBundledMediaPath } from '../lib/server/bundledMedia';

export const Media: CollectionConfig = {
  slug: 'media',
  hooks: {
    afterRead: [async ({ doc }) => {
      if (!process.env.S3_PUBLIC_URL && await getBundledMediaPath(doc.sourcePath)) {
        doc.url = bundledMediaURL(doc.sourcePath);
        doc.thumbnailURL = doc.url;
      }
      return doc;
    }],
  },
  upload: true,
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize'],
  },
  fields: [
    {
      name: 'sourcePath',
      type: 'text',
      unique: true,
      admin: { description: 'Original path used by the app, relative to /images.' },
    },
    {
      name: 'alt',
      type: 'text',
      label: 'Alt Text',
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Caption',
    },
  ],
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
    update: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
    delete: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
  },
};
