import type { CollectionConfig } from 'payload';
import { invalidateCmsCache } from '@/lib/payloadCacheHooks';
import { notifyDeveloperSubscribers } from '@/lib/server/propertyNotifications';

export const Properties: CollectionConfig = {
  slug: 'properties',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'purpose', 'type', 'area', 'price', 'broker', 'updatedAt'],
    listSearchableFields: ['title', 'ref', 'area', 'community'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [invalidateCmsCache, notifyDeveloperSubscribers],
    afterDelete: [invalidateCmsCache],
  },
  fields: [
    // ── Core ─────────────────────────────────────────────────
    { name: 'title', type: 'text', required: true },
    {
      name: 'appData',
      type: 'json',
      admin: { hidden: true },
      access: {
        read: ({ req: { user }, doc }) =>
          Boolean(user && (user.collection === 'users' || String(doc?.appData?.ownerMemberId) === String(user.id))),
      },
    },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'ref', type: 'text', label: 'Reference Number (e.g. E08-12345)' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Pending Review', value: 'pending' },
        { label: 'Published', value: 'published' },
        { label: 'Unpublished', value: 'unpublished' },
        { label: 'Sold', value: 'sold' },
        { label: 'Rented', value: 'rented' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    // ── Purpose & Type ────────────────────────────────────────
    {
      name: 'purpose',
      type: 'select',
      required: true,
      options: [
        { label: 'For Sale', value: 'sale' },
        { label: 'For Rent', value: 'rent' },
      ],
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Residential', value: 'residential' },
        { label: 'Commercial', value: 'commercial' },
        { label: 'Land', value: 'land' },
      ],
      defaultValue: 'residential',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Apartment', value: 'Apartment' },
        { label: 'Villa', value: 'Villa' },
        { label: 'Townhouse', value: 'Townhouse' },
        { label: 'Penthouse', value: 'Penthouse' },
        { label: 'Duplex', value: 'Duplex' },
        { label: 'Office', value: 'Office' },
        { label: 'Retail', value: 'Retail' },
        { label: 'Warehouse', value: 'Warehouse' },
        { label: 'Plot', value: 'Plot' },
        { label: 'Hotel apartment', value: 'Hotel apartment' },
        { label: 'Residential building', value: 'Residential building' },
        { label: 'Shop / Retail', value: 'Shop / Retail' },
        { label: 'Showroom', value: 'Showroom' },
        { label: 'Commercial villa', value: 'Commercial villa' },
        { label: 'Commercial building', value: 'Commercial building' },
        { label: 'Factory', value: 'Factory' },
        { label: 'Labour accommodation', value: 'Labour accommodation' },
        { label: 'Residential plot', value: 'Residential plot' },
        { label: 'Commercial plot', value: 'Commercial plot' },
        { label: 'Industrial plot', value: 'Industrial plot' },
        { label: 'Mixed-use plot', value: 'Mixed-use plot' },
      ],
    },
    {
      name: 'completion',
      type: 'select',
      options: [
        { label: 'Ready', value: 'ready' },
        { label: 'Off-Plan', value: 'offplan' },
      ],
      defaultValue: 'ready',
    },
    // ── Location ──────────────────────────────────────────────
    {
      name: 'emirate',
      type: 'select',
      defaultValue: 'Dubai',
      options: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Umm Al Quwain', 'Fujairah'].map((e) => ({
        label: e,
        value: e,
      })),
    },
    { name: 'area', type: 'text', label: 'Area / Neighbourhood', required: true },
    { name: 'community', type: 'text', label: 'Community / Building' },
    { name: 'address', type: 'text' },
    {
      name: 'coordinates',
      type: 'group',
      label: 'Map Coordinates',
      fields: [
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
      ],
    },
    // ── Specs ─────────────────────────────────────────────────
    { name: 'price', type: 'number', required: true, label: 'Price (AED)' },
    { name: 'priceOnRequest', type: 'checkbox', label: 'Price on Request', defaultValue: false },
    { name: 'size', type: 'number', label: 'Size (sqft)' },
    { name: 'beds', type: 'number', label: 'Bedrooms (0 = Studio)' },
    { name: 'baths', type: 'number', label: 'Bathrooms' },
    { name: 'parking', type: 'number', label: 'Parking Spaces' },
    { name: 'floor', type: 'number', label: 'Floor Number' },
    { name: 'totalFloors', type: 'number', label: 'Total Floors' },
    // ── Description ───────────────────────────────────────────
    { name: 'description', type: 'textarea', label: 'Description' },
    {
      name: 'highlights',
      type: 'array',
      label: 'Highlights (e.g. "Burj Khalifa view")',
      fields: [{ name: 'highlight', type: 'text' }],
    },
    {
      name: 'amenities',
      type: 'array',
      label: 'Amenities',
      fields: [{ name: 'amenity', type: 'text' }],
    },
    // ── Media ─────────────────────────────────────────────────
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Featured Image',
    },
    {
      name: 'photos',
      type: 'array',
      label: 'Gallery',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'floorplans',
      type: 'array',
      label: 'Floor Plans',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'label', type: 'text' },
      ],
    },
    // ── Permit ────────────────────────────────────────────────
    {
      name: 'permit',
      type: 'group',
      label: 'RERA Permit',
      fields: [
        { name: 'number', type: 'text', label: 'Permit Number' },
        { name: 'expiry', type: 'date', label: 'Expiry Date' },
        { name: 'document', type: 'upload', relationTo: 'media', label: 'Permit Document' },
      ],
    },
    // ── Broker ────────────────────────────────────────────────
    {
      name: 'broker',
      type: 'relationship',
      relationTo: 'brokers',
      label: 'Listing Broker',
      admin: { description: 'Legacy compatibility field. Use Primary Broker below for new records.' },
    },
    {
      name: 'primaryBroker',
      type: 'relationship',
      relationTo: 'brokers',
      label: 'Primary Broker',
      admin: { description: 'The broker currently authorized to represent this property.' },
    },
    {
      name: 'ownerType',
      type: 'select',
      label: 'Owner Type',
      defaultValue: 'developer',
      options: [
        { label: 'Developer', value: 'developer' },
        { label: 'Agency', value: 'agency' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'ownerDeveloper',
      type: 'relationship',
      relationTo: 'members',
      label: 'Developer Owner',
    },
    {
      name: 'ownerAgency',
      type: 'relationship',
      relationTo: 'agencies',
      label: 'Agency Owner',
    },
    {
      name: 'ownerDirect',
      type: 'checkbox',
      defaultValue: false,
      label: 'Owner-direct listing',
      admin: { description: 'The developer can publish publicly before a primary broker is assigned.' },
    },
    {
      name: 'claimable',
      type: 'checkbox',
      defaultValue: false,
      label: 'Open for broker claims',
    },
    {
      name: 'claimPolicy',
      type: 'select',
      defaultValue: 'developer_approval',
      options: [{ label: 'Developer approval required', value: 'developer_approval' }],
    },
    // ── Off-Plan specific ─────────────────────────────────────
    {
      name: 'offplan',
      type: 'group',
      label: 'Off-Plan Details',
      admin: { condition: (data) => data.completion === 'offplan' },
      fields: [
        { name: 'developer', type: 'text' },
        { name: 'handover', type: 'text', label: 'Expected Handover (e.g. Q4 2026)' },
        {
          name: 'paymentPlan',
          type: 'array',
          label: 'Payment Plan Milestones',
          fields: [
            { name: 'label', type: 'text', label: 'Milestone' },
            { name: 'percent', type: 'number', label: '% of Total' },
          ],
        },
      ],
    },
    // ── Display & Visibility ──────────────────────────────────
    {
      name: 'display',
      type: 'group',
      label: 'Display Settings',
      fields: [
        { name: 'visible', type: 'checkbox', defaultValue: true, label: 'Visible on site' },
        { name: 'portfolioFeatured', type: 'checkbox', defaultValue: false, label: 'Featured in broker portfolio' },
        {
          name: 'contact',
          type: 'select',
          defaultValue: 'any',
          options: [
            { label: 'Any (phone + WhatsApp + email)', value: 'any' },
            { label: 'Phone only', value: 'phone' },
            { label: 'WhatsApp only', value: 'whatsapp' },
            { label: 'Email only', value: 'email' },
          ],
        },
      ],
    },
    // ── Rent specific ─────────────────────────────────────────
    {
      name: 'rent',
      type: 'group',
      label: 'Rent Details',
      admin: { condition: (data) => data.purpose === 'rent' },
      fields: [
        {
          name: 'frequency',
          type: 'select',
          defaultValue: 'yearly',
          options: [
            { label: 'Yearly', value: 'yearly' },
            { label: 'Monthly', value: 'monthly' },
          ],
        },
        { name: 'cheques', type: 'number', label: 'Cheques accepted' },
      ],
    },
  ],
};
