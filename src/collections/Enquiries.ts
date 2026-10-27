import type { CollectionConfig } from 'payload';

export const Enquiries: CollectionConfig = {
  slug: 'enquiries',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'property', 'broker', 'type', 'createdAt'],
  },
  access: {
    // Public creation and member inbox access go through scoped server routes.
    create: () => false,
    read: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
    update: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
    delete: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'phone', type: 'text' },
    { name: 'message', type: 'textarea', required: true },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Property Enquiry', value: 'property' },
        { label: 'Broker Enquiry', value: 'broker' },
        { label: 'General', value: 'general' },
      ],
      defaultValue: 'general',
    },
    {
      name: 'property',
      type: 'relationship',
      relationTo: 'properties',
      label: 'Related Property',
    },
    { name: 'propertyRef', type: 'text', label: 'Property Reference' },
    { name: 'propertyTitle', type: 'text' },
    { name: 'brokerRef', type: 'text', label: 'Broker Reference' },
    { name: 'kind', type: 'select', options: [
      { label: 'Message', value: 'message' },
      { label: 'Viewing Request', value: 'viewing' },
    ] },
    { name: 'preferredDate', type: 'text' },
    {
      name: 'brokerMember',
      type: 'relationship',
      relationTo: 'members',
      label: 'Member Broker',
    },
    {
      name: 'fromMember',
      type: 'relationship',
      relationTo: 'members',
      label: 'Member Contact',
    },
    {
      name: 'broker',
      type: 'relationship',
      relationTo: 'brokers',
      label: 'Related Broker',
    },
    {
      name: 'preferredContact',
      type: 'select',
      label: 'Preferred Contact Method',
      options: [
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Any', value: 'any' },
      ],
      defaultValue: 'any',
    },
    { name: 'budget', type: 'number', label: 'Budget (AED)' },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'New', value: 'new' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Replied', value: 'replied' },
        { label: 'Closed', value: 'closed' },
      ],
      defaultValue: 'new',
    },
    { name: 'notes', type: 'textarea', label: 'Internal Notes' },
    {
      name: 'source',
      type: 'text',
      label: 'Source URL',
      admin: { description: 'Page the form was submitted from' },
    },
  ],
};
