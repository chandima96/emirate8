import 'dotenv/config';
import { getPayload } from 'payload';
import configPromise from '../payload.config';
import { listingFromProperty, syncMemberProperties } from '../src/lib/server/member-properties';

const accounts = [
  {
    email: 'developer@testmail.com',
    password: process.env.DEMO_DEVELOPER_PASSWORD || '',
    name: 'Maya Developer',
    type: 'developer',
    plan: 'developer-bronze',
    profile: {
      legalName: 'Demo Horizon Developments LLC',
      developer: {
        slug: 'demo-horizon-developments',
        name: 'Demo Horizon Developments',
        website: 'https://example.com',
        location: 'Business Bay, Dubai',
        description: 'Demo developer account with sample Dubai project inventory.',
        public: true,
      },
      trial: false,
      notifications: { enquiries: true, network: true, selection: true, billing: true, product: false },
      privacy: { showPhone: false, showEmail: false, showWhatsapp: false, showBrn: false },
      prefs: { language: 'English', currency: 'AED', contact: 'email' },
    },
    listings: [
      {
        id: 'demo-developer-creek-residences', title: 'Creekside Residences | Demo Inventory', purpose: 'sale',
        type: 'Apartment', category: 'residential', completion: 'offplan', emirate: 'Dubai', area: 'Dubai Creek Harbour',
        community: 'Creekside Residences', price: 1850000, size: 980, beds: 1, baths: 2, parking: 1,
        featured: '/images/downtown-aerial.webp', images: ['/images/downtown-aerial.webp', '/images/palm-jumeirah.webp'],
        description: 'Demo off-plan one-bedroom residence with open-plan living, a balcony and community facilities. Sample listing data for workspace review.',
        status: 'published', highlights: ['Waterfront community', 'Payment plan available'], amenities: ['Balcony', 'Shared pool', 'Shared gym'],
        offplan: { project: 'Creekside Residences', developer: 'Demo Horizon Developments', devType: 'Residential tower', devStatus: 'Under construction', handover: 'Q4 2027', plan: [{ id: 'demo-m1', label: 'Booking', stage: 'booking', pct: 20, due: 'On reservation' }, { id: 'demo-m2', label: 'Construction', stage: 'construction', pct: 40, due: 'During construction' }, { id: 'demo-m3', label: 'Handover', stage: 'handover', pct: 40, due: 'At completion' }] },
        display: { visible: true, portfolioFeatured: false, contact: 'any' }, sample: true,
      },
      {
        id: 'demo-developer-jvc-townhouse', title: 'Garden District Townhouse | Demo Inventory', purpose: 'sale',
        type: 'Townhouse', category: 'residential', completion: 'ready', emirate: 'Dubai', area: 'Jumeirah Village Circle',
        community: 'Garden District', price: 2450000, size: 2100, beds: 3, baths: 4, parking: 2,
        featured: '/images/dubai-hills.webp', images: ['/images/dubai-hills.webp', '/images/downtown-dubai.webp'],
        description: 'Sample ready townhouse listing with a private garden, generous living space and two covered parking bays. Demo data for testing the developer workspace.',
        status: 'published', highlights: ['Private garden', 'Family layout'], amenities: ['Private garden', 'Covered parking', 'Shared pool'],
        display: { visible: true, portfolioFeatured: false, contact: 'any' }, sample: true,
      },
    ],
  },
  {
    email: 'broker@testmail.com',
    password: process.env.DEMO_BROKER_PASSWORD || '',
    name: 'Aisha Rahman',
    type: 'broker',
    plan: 'broker-bronze',
    profile: {
      portfolio: {
        slug: 'aisha-rahman-demo', displayName: 'Aisha Rahman', title: 'Dubai Property Consultant',
        headline: 'Sample Dubai homes and investment properties.',
        bio: 'Demo broker profile for testing property listings, portfolio presentation and workspace tools. Profile details are fictional sample data.',
        experience: '6 years', languages: ['English', 'Arabic'], areas: ['Dubai Marina', 'Downtown Dubai', 'Business Bay'],
        specialties: ['Residential sales', 'Long-term rentals'], publicEmail: 'broker@testmail.com',
        publicPhone: '+971 50 000 0201', whatsapp: '+971 50 000 0201', isPublic: true, searchable: true,
      },
      credentials: { brn: 'DEMO-BRN-10001' },
      privacy: { showPhone: true, showEmail: true, showWhatsapp: true, showBrn: false },
      notifications: { enquiries: true, network: true, selection: true, billing: true, product: false },
    },
    listings: [
      {
        id: 'demo-broker-marina-apartment', title: 'Bright Marina Apartment | Demo Listing', purpose: 'sale',
        type: 'Apartment', category: 'residential', completion: 'ready', emirate: 'Dubai', area: 'Dubai Marina',
        community: 'Marina Promenade', price: 2150000, size: 1180, beds: 2, baths: 2, parking: 1,
        featured: '/images/dubai-marina.webp', images: ['/images/dubai-marina.webp', '/images/palm-jumeirah.webp'],
        description: 'Fictional sample two-bedroom apartment with a bright living area, balcony and marina community amenities. This listing is for product demonstration only.',
        status: 'published', highlights: ['Balcony', 'Marina community'], amenities: ['Balcony', 'Shared pool', 'Shared gym', 'Covered parking'],
        display: { visible: true, portfolioFeatured: true, contact: 'any' }, sample: true,
      },
      {
        id: 'demo-broker-downtown-rental', title: 'Downtown One-Bedroom | Demo Rental', purpose: 'rent',
        type: 'Apartment', category: 'residential', completion: 'ready', emirate: 'Dubai', area: 'Downtown Dubai',
        community: 'Boulevard Point', price: 125000, size: 840, beds: 1, baths: 1, parking: 1,
        featured: '/images/downtown-dubai.webp', images: ['/images/downtown-dubai.webp', '/images/downtown-aerial.webp'],
        description: 'Fictional sample annual rental listing in Downtown Dubai, with a practical one-bedroom layout and easy access to local retail and transport.',
        status: 'published', highlights: ['Furnished option', 'City centre'], amenities: ['Built-in wardrobes', 'Shared pool', 'Covered parking'],
        display: { visible: true, portfolioFeatured: false, contact: 'any' }, sample: true,
      },
    ],
  },
  {
    email: 'agancy@testmai.com',
    password: process.env.DEMO_AGENCY_PASSWORD || '',
    name: 'Cedar Lane Realty',
    type: 'agency',
    plan: 'agency-silver',
    profile: {
      legalName: 'Cedar Lane Realty LLC',
      agency: { name: 'Cedar Lane Realty', slug: 'cedar-lane-realty-demo', agencyRole: 'agency_manager' },
      portfolio: {
        slug: 'cedar-lane-realty-demo', displayName: 'Cedar Lane Realty', title: 'Dubai Real Estate Agency',
        headline: 'Sample agency inventory across Dubai.',
        bio: 'Demo agency profile with fictional staff and property data for testing the agency workspace.',
        areas: ['Dubai Marina', 'Business Bay'], specialties: ['Residential sales', 'Leasing'],
        publicEmail: 'agancy@testmai.com', publicPhone: '+971 50 000 0301', isPublic: true, searchable: true,
      },
      privacy: { showPhone: true, showEmail: true, showWhatsapp: false, showBrn: false },
      notifications: { enquiries: true, network: true, selection: true, billing: true, product: false },
    },
    listings: [
      {
        id: 'demo-agency-business-bay-office', title: 'Fitted Business Bay Office | Demo Listing', purpose: 'rent',
        type: 'Office', category: 'commercial', completion: 'ready', emirate: 'Dubai', area: 'Business Bay',
        community: 'Bay Square', price: 185000, size: 1450, beds: 0, baths: 2, parking: 2,
        featured: '/images/business-bay.webp', images: ['/images/business-bay.webp', '/images/downtown-aerial.webp'],
        description: 'Fictional sample fitted office with reception space, meeting room and two parking spaces. Demo data for exercising agency listing tools.',
        status: 'published', highlights: ['Fitted office', 'Business district'], amenities: ['Fitted', 'Reception', 'Covered parking'],
        display: { visible: true, portfolioFeatured: true, contact: 'any' }, sample: true,
      },
      {
        id: 'demo-agency-hills-villa', title: 'Family Villa near the Park | Demo Listing', purpose: 'sale',
        type: 'Villa', category: 'residential', completion: 'ready', emirate: 'Dubai', area: 'Dubai Hills Estate',
        community: 'Maple', price: 4650000, size: 3100, beds: 4, baths: 4, parking: 2,
        featured: '/images/dubai-hills.webp', images: ['/images/dubai-hills.webp', '/images/palm-jumeirah.webp'],
        description: 'Fictional sample four-bedroom family villa with a garden and nearby community park. Demo listing content for the agency workspace.',
        status: 'published', highlights: ['Park nearby', 'Family home'], amenities: ['Private garden', 'Built-in wardrobes', 'Covered parking'],
        display: { visible: true, portfolioFeatured: false, contact: 'any' }, sample: true,
      },
    ],
  },
];

async function seedDemoUsers() {
  for (const account of accounts) {
    if (account.password.length < 8) throw new Error(`Set a valid DEMO_${account.type.toUpperCase()}_PASSWORD environment value.`);
  }

  const config = await configPromise;
  const payload = await getPayload({ config });

  for (const account of accounts) {
    const found = await payload.find({ collection: 'members', where: { email: { equals: account.email } }, limit: 1, overrideAccess: true });
    const commonData = {
      name: account.name,
      accountType: account.type,
      mobile: account.profile.portfolio?.publicPhone || '',
      profile: account.profile,
      credentialStatus: 'pending',
      plan: account.plan,
      adminCreated: false,
      adminAccess: false,
    } as any;
    const member: any = found.docs[0]
      ? await payload.update({ collection: 'members', id: found.docs[0].id, data: { ...commonData, password: account.password } as any, overrideAccess: true })
      : await payload.create({ collection: 'members', data: { ...commonData, email: account.email, password: account.password } as any, overrideAccess: true });

    const existingProperties = await payload.find({
      collection: 'properties',
      where: { 'appData.ownerMemberId': { equals: member.id } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });
    const listings = (existingProperties.docs as any[]).map(listingFromProperty);
    for (const listing of account.listings) {
      const existingIndex = listings.findIndex((existing) => existing.id === listing.id);
      if (existingIndex < 0) listings.push(listing);
      else {
        const existing = listings[existingIndex];
        listings[existingIndex] = {
          ...existing,
          featured: existing.featured || listing.featured,
          images: existing.images?.length ? existing.images : listing.images,
        };
      }
    }
    await syncMemberProperties(payload, Number(member.id), { listings });

    if (account.type === 'agency') {
      const agencyData = {
        name: 'Cedar Lane Realty', slug: 'cedar-lane-realty-demo', licenseNumber: 'DEMO-AGENCY-LICENSE',
        description: 'Fictional agency profile for demonstration and workspace testing.', location: 'Business Bay, Dubai',
        phone: '+971 50 000 0301', email: account.email, website: 'https://example.com', verified: false,
      };
      const agencies = await payload.find({ collection: 'agencies', where: { slug: { equals: agencyData.slug } }, limit: 1, overrideAccess: true });
      const agency: any = agencies.docs[0]
        ? await payload.update({ collection: 'agencies', id: agencies.docs[0].id, data: agencyData as any, overrideAccess: true })
        : await payload.create({ collection: 'agencies', data: agencyData as any, overrideAccess: true });
      await payload.update({
        collection: 'members', id: member.id,
        data: { profile: { ...account.profile, agency: { ...account.profile.agency, agencyId: agency.id } } } as any,
        overrideAccess: true,
      });
    }
    console.log(`Seeded demo ${account.type} account and ${account.listings.length} sample listings: ${account.email}`);
  }
  console.log('Demo user seed complete. Accounts are marked pending verification; all records are identified as sample data.');
  process.exit(0);
}

seedDemoUsers().catch((error) => {
  console.error('Demo user seed failed:', error);
  process.exit(1);
});
