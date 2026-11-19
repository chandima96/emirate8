import type { CollectionConfig } from 'payload';
import { invalidateCmsCache } from '@/lib/payloadCacheHooks';

const isAdmin = ({ req: { user } }: any) => Boolean(user?.collection === 'users' && ['admin', 'subadmin'].includes(user.role));

/*
 * SEO content written by the SEO content agent (src/lib/server/seoAgent): title, meta description and
 * FAQ for one public property or broker page. A page shows it only when it is approved and its
 * source hash still matches the record's current facts, so edited listings never show stale claims.
 */
export const SeoContent: CollectionConfig = {
  slug: 'seo-content',
  admin: {
    useAsTitle: 'path',
    group: 'Platform',
    defaultColumns: ['path', 'status', 'title', 'generatedAt'],
    description:
      'Written by the SEO content agent from each record’s public facts. Review drafts and set them to Approved to publish them on the page.',
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [invalidateCmsCache],
    afterDelete: [invalidateCmsCache],
  },
  fields: [
    { name: 'path', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Property', value: 'property' },
        { label: 'Broker', value: 'broker' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Draft (needs review)', value: 'draft' },
        { label: 'Approved (shown on the page)', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'title', type: 'text', admin: { description: 'Page title (the site name is added automatically).' } },
    { name: 'metaDescription', type: 'textarea' },
    { name: 'faq', type: 'json', admin: { description: 'Array of { question, answer }. Shown on the page and as FAQPage structured data.' } },
    { name: 'issues', type: 'json', admin: { description: 'Problems the agent found with the record or page. Not shown publicly.' } },
    {
      name: 'sourceHash',
      type: 'text',
      admin: { readOnly: true, description: 'Hash of the facts the content was written from. A different hash means the record changed.' },
    },
    { name: 'model', type: 'text', admin: { readOnly: true } },
    { name: 'generatedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'error', type: 'textarea', admin: { readOnly: true, condition: (data) => data?.status === 'failed' } },
  ],
};
