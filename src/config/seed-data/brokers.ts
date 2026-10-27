/* Sample brokers ΓÇö fictional records for demonstration. */
import { slugify } from '@/lib/utils';
import { im } from '@/config/images';

export const BROKERS = {
  b1: {
    slug: 'omar-haddad',
    name: 'Omar Haddad',
    title: 'Independent Property Consultant',
    agency: null,
    brn: 'Sample BRN 30418',
    brnVerified: true,
    phone: '+971 50 000 0101',
    whatsapp: '+971 50 000 0101',
    email: 'omar.haddad@example.com',
    experience: 9,
    areas: ['Dubai Marina', 'Jumeirah Lake Towers', 'Business Bay'],
    languages: ['English', 'Arabic'],
    specialties: ['Waterfront apartments', 'Investor studios', 'Off-plan resale'],
    cover: im('dubai-marina'),
    headline: 'Dubai Marina and JLT apartments for owner-occupiers and investors.',
    bio: 'Omar works with buyers and tenants across Dubai Marina, JLT and Business Bay, focusing on high-floor apartments and investor-friendly studios. He prepares a written brief for every client ΓÇö budget, building shortlist, service charges and expected rental demand ΓÇö before the first viewing.\n\nAs an independent broker he cooperates with other agencies through the Emirate08 network, so clients see more of the market than a single agencyΓÇÖs stock.',
  },
  b2: {
    slug: 'priya-nair',
    name: 'Priya Nair',
    title: 'Senior Property Consultant',
    agency: { name: 'Harbourview Properties', website: '' },
    brn: 'Sample BRN 41207',
    brnVerified: true,
    phone: '+971 50 000 0102',
    whatsapp: '+971 50 000 0102',
    email: 'priya.nair@example.com',
    experience: 7,
    areas: ['Dubai Creek Harbour', 'Business Bay'],
    languages: ['English', 'Hindi', 'Malayalam'],
    specialties: ['Off-plan', 'Commercial offices'],
    cover: im('prop-creek-towers'),
    headline: 'Off-plan apartments at Dubai Creek Harbour and fitted offices in Business Bay.',
    bio: 'Priya advises investors on off-plan apartments around Dubai Creek Harbour and on fitted office space in Business Bay, from the first viewing through to handover. She walks clients through payment plans milestone by milestone and keeps them updated on construction progress.',
  },
  b3: {
    slug: 'daniel-whitmore',
    name: 'Daniel Whitmore',
    title: 'Leasing and Sales Broker',
    agency: null,
    brn: 'Sample BRN 27735',
    brnVerified: true,
    phone: '+971 50 000 0103',
    whatsapp: '+971 50 000 0103',
    email: 'daniel.whitmore@example.com',
    experience: 6,
    areas: ['Downtown Dubai', 'City Walk'],
    languages: ['English', 'French'],
    specialties: ['Apartments', 'Rentals', 'First-time buyers'],
    cover: im('downtown-aerial'),
    headline: 'Downtown Dubai apartments for tenants and first-time buyers.',
    bio: 'Daniel focuses on Downtown Dubai apartments for tenants and first-time buyers, with detailed knowledge of the Boulevard buildings and Old Town. He handles the full leasing process ΓÇö offer, tenancy contract and Ejari registration ΓÇö so clients know what to expect at each step.',
  },
  b4: {
    slug: 'fatima-al-suwaidi',
    name: 'Fatima Al Suwaidi',
    title: 'Family Homes Specialist',
    agency: null,
    brn: 'Sample BRN 38862',
    brnVerified: false,
    phone: '+971 50 000 0104',
    whatsapp: '+971 50 000 0104',
    email: 'fatima.alsuwaidi@example.com',
    experience: 5,
    areas: ['Dubai Hills Estate', 'Arabian Ranches'],
    languages: ['Arabic', 'English'],
    specialties: ['Family rentals', 'Townhouses', 'Villas'],
    cover: im('dubai-hills'),
    headline: 'Townhouses and villas near schools and parks.',
    bio: 'Fatima helps families find townhouses and villas near schools and parks, mainly in Dubai Hills Estate and Arabian Ranches. She shortlists homes around school catchments and commute times and arranges back-to-back viewings to save clients time.',
  },
  b5: {
    slug: 'ravi-menon',
    name: 'Ravi Menon',
    title: 'Waterfront Property Advisor',
    agency: { name: 'Palmgate Realty', website: '' },
    brn: 'Sample BRN 45120',
    brnVerified: true,
    phone: '+971 50 000 0105',
    whatsapp: '+971 50 000 0105',
    email: 'ravi.menon@example.com',
    experience: 11,
    areas: ['Palm Jumeirah', 'Jumeirah'],
    languages: ['English', 'Hindi'],
    specialties: ['Villas', 'Waterfront apartments'],
    cover: im('palm-aerial'),
    headline: 'Villas and waterfront apartments on Palm Jumeirah and Jumeirah.',
    bio: 'Ravi represents villa and waterfront apartment owners on Palm Jumeirah and in Jumeirah, and arranges discreet viewings for buyers. He works closely with owners on presentation and pricing before a property is advertised.',
  },
  b6: {
    slug: 'layla-mansour',
    name: 'Layla Mansour',
    title: 'Luxury Residential Broker',
    agency: null,
    brn: 'Sample BRN 33094',
    brnVerified: true,
    phone: '+971 50 000 0106',
    whatsapp: '+971 50 000 0106',
    email: 'layla.mansour@example.com',
    experience: 8,
    areas: ['Al Barari', 'City Walk', 'Dubai Marina'],
    languages: ['English', 'Arabic', 'French'],
    specialties: ['Villas', 'Penthouses'],
    cover: im('cta-dubai-dusk'),
    headline: 'Large family villas and penthouses.',
    bio: 'Layla specialises in large family villas in Al Barari and penthouses across central Dubai. She advises on layout, maintenance and running costs as much as on price, and represents both buyers and owners.',
  },
};
Object.keys(BROKERS).forEach(function (k, i) {
  var b = BROKERS[k];
  b.id = k;
  b.sample = true;
  b.since = 'October 2026';
  b.tone = i % 4;
  b.preferred = 'whatsapp';
  b.showClosed = true;
  b.defaultSort = 'newest';
  b.coverPos = 50;
  b.initials = b.name
    .split(' ')
    .map(function (x) {
      return x[0];
    })
    .slice(0, 2)
    .join('');
  b.independent = !b.agency;
  b.agencyName = b.agency ? b.agency.name : '';
  b.agencyId = b.agency ? slugify(b.agency.name) : '';
  b.intro = b.headline;
  b.isPublic = true;
  b.searchable = true;
  b.showTransactions = true;
  b.featuredOrder = [];
  b.credentials = [{ label: 'RERA broker registration (BRN)', value: b.brn, verified: b.brnVerified }];
});
