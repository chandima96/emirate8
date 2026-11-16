/* Seeds every broker-profile and agency-profile field for two test accounts, so the profile dashboards and the public
 * pages (/brokers/[slug], /agencies/[id]) can be tested with complete data.
 *
 *   SEED_BROKER_PASSWORD=… SEED_AGENCY_PASSWORD=… npm run seed:profile-test
 *
 * Accounts: broker@testmail.com (independent broker) and agency@testmail.com (agency admin). Missing accounts are
 * created; existing ones keep their other settings. All people, companies and listings are fictional sample data.
 * The accounts are marked verified so the verified badges, BRN/ORN rows and approved achievements can be tested. */
import 'dotenv/config';
import { getPayload } from 'payload';
import configPromise from '../payload.config';
import { listingFromProperty, syncMemberProperties } from '../src/lib/server/member-properties';
import { syncMemberBroker } from '../src/lib/server/member-brokers';

const PIMG = '/images/property-images/';
const now = new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

/* ---------------------------------------------------------------- broker */
const BROKER_EMAIL = 'broker@testmail.com';
const brokerPortfolio = {
  slug: 'aisha-rahman-demo',
  displayName: 'Aisha Rahman',
  title: 'Senior Real Estate Consultant',
  headline: 'Waterfront and off-plan specialist across Dubai Marina, Downtown and Business Bay',
  intro: 'Helping buyers, sellers, and investors navigate Dubai’s real estate market with confidence. Specializing in luxury properties, residential investments, and personalized property solutions.',
  location: 'Dubai, UAE',
  experience: 9,
  languages: ['English', 'Arabic', 'French'],
  photo: '/images/profile/avatar-aisha.svg',
  bio: 'I work with buyers who want clear, unhurried advice in a fast-moving market. Most of my clients are buying their first or second home in Dubai, or investing from abroad, and want someone who will tell them which buildings to avoid as readily as which to view.\n\nBefore every viewing I share service charges, recent comparable sales and the developer’s handover record, so decisions are made on numbers rather than brochures.',
  journey: 'I started in 2017 as a leasing agent in Dubai Marina, moved into sales two years later and have been independent since 2022. Working one community at a time taught me how service charges, view corridors and handover quality really differ between towers.',
  experienceEntries: [
    { id: 'ex-seed-1', agencyId: null, agencyName: 'Aisha Rahman Real Estate', position: 'Independent Real Estate Consultant', start: '2022-01', end: '', current: true, desc: 'Buyer representation and off-plan advisory across Dubai Marina, Downtown and Business Bay.' },
    { id: 'ex-seed-2', agencyId: null, agencyName: 'Harbour Lane Properties', position: 'Real Estate Consultant', start: '2019-03', end: '2021-12', current: false, desc: 'Resale apartments in Dubai Marina and JLT; moved from leasing into sales.' },
    { id: 'ex-seed-3', agencyId: null, agencyName: 'Marina Leasing Co.', position: 'Leasing Agent', start: '2017-02', end: '2019-02', current: false, desc: 'Annual rentals and renewals across Dubai Marina towers.' },
  ],
  clients: ['First-time buyers', 'Relocating families', 'International investors', 'Upsizing homeowners'],
  specialties: ['Residential Sales', 'Waterfront Apartments', 'Off-Plan Properties', 'Investment Apartments'],
  services: ['Buyer representation', 'Off-plan launch advisory', 'Resale price guidance', 'Viewing coordination', 'Mortgage and conveyancing referrals'],
  whyPoints: [
    { icon: 'geo-alt', title: 'Local Market Expertise', desc: 'In-depth knowledge of Dubai’s most sought-after residential communities.' },
    { icon: 'signpost-split', title: 'Personalised Guidance', desc: 'Helping clients discover opportunities that match their needs and goals.' },
    { icon: 'chat-dots', title: 'Transparent Communication', desc: 'Clear, reliable guidance throughout every stage of the property journey.' },
    { icon: 'clipboard-check', title: 'End-to-End Support', desc: 'Dedicated assistance from the first consultation to the final transaction.' },
  ],
  approach: 'I start with your budget, timeline and how you will use the home, then shortlist no more than five properties with the numbers side by side. For off-plan purchases I review the payment plan, escrow registration and handover history of the developer.',
  areas: ['Dubai Marina', 'Downtown Dubai', 'Business Bay', 'Dubai Creek Harbour', 'Jumeirah Lake Towers'],
  areaMeta: {
    'Dubai Marina': { primary: true, note: 'Lived here for six years; know which towers have the best management and quieter facing.' },
    'Downtown Dubai': { primary: true, note: 'Boulevard and Opera District resale and rentals.' },
    'Business Bay': { primary: true, note: 'Canal-front apartments and new launches.' },
    'Dubai Creek Harbour': { primary: false, note: 'Off-plan launches and early handovers.' },
    'Jumeirah Lake Towers': { primary: false, note: '' },
  },
  credentials: [
    { label: 'Certified Off-Plan Sales Specialist', issuer: 'Dubai Real Estate Institute', value: 'DREI-OP-2291', expires: '2027-06-30', verified: true },
    { label: 'RICS Associate (AssocRICS)', issuer: 'Royal Institution of Chartered Surveyors', value: 'RICS-6620413', expires: '', verified: false },
  ],
  publicEmail: BROKER_EMAIL,
  publicPhone: '+971 50 000 4821',
  whatsapp: '+971 50 000 4821',
  preferred: 'whatsapp',
  booking: 'https://calendly.com/example-aisha-rahman',
  website: 'https://aisha-rahman.example.com',
  socials: [
    { platform: 'Instagram', url: 'https://www.instagram.com/example.aisha.rahman' },
    { platform: 'LinkedIn', url: 'https://www.linkedin.com/in/example-aisha-rahman' },
    { platform: 'Facebook', url: 'https://www.facebook.com/example.aisha.rahman' },
  ],
  reviewSources: [
    { platform: 'Google Reviews', url: 'https://www.google.com/maps/search/?api=1&query=Aisha+Rahman+Real+Estate+Dubai' },
    { platform: 'Property Finder', url: 'https://www.propertyfinder.ae/en/find-agent' },
    { platform: 'Bayut', url: 'https://www.bayut.com/brokers/' },
  ],
  achievements: [
    { id: 'ac-seed-1', kind: 'Case study', title: 'From London video call to Marina keys in five weeks', detail: 'Shortlisted four buildings for a relocating family, ran remote viewings, and coordinated mortgage valuation and transfer.', date: '2026-08', evidence: 'Client consent on file', approved: true },
    { id: 'ac-seed-2', kind: 'Professional award', title: 'Top Off-Plan Consultant — Dubai Marina', detail: 'Recognised for the highest number of off-plan transactions completed in the community in 2025.', date: '2025-12', evidence: 'Award certificate uploaded', approved: true },
    { id: 'ac-seed-3', kind: 'Notable transaction', title: 'Full-floor penthouse resale, Dubai Marina', detail: 'Off-market sale negotiated in nine days for an overseas buyer.', date: '2026-05', evidence: 'Pending document check', approved: false },
  ],
  defaultSort: 'featured',
  showClosed: true,
  featuredOrder: ['seed-broker-marina-gate', 'seed-broker-seapoint-penthouse'],
  isPublic: true,
  searchable: true,
  indexable: true,
  showSocials: true,
  contactMode: 'all',
  cover: '/images/profile/cover-broker.svg',
  coverPos: 50,
  updatedAt: now,
  publishedAt: now,
};

const L = (o: any) => ({
  emirate: 'Dubai', category: 'residential', completion: 'ready', parking: 1, highlights: [], amenities: ['Balcony', 'Shared pool', 'Shared gym'],
  display: { visible: true, portfolioFeatured: false, contact: 'any' }, sample: true, createdAt: daysAgo(o.age || 10), ...o,
  images: o.images || [o.featured], photos: (o.images || [o.featured]).map((src: string) => ({ src, caption: '' })),
});
const brokerListings = [
  L({ id: 'seed-broker-marina-gate', title: '2-bedroom apartment with marina views in Marina Gate 2', purpose: 'sale', type: 'Apartment', area: 'Dubai Marina', community: 'Marina Gate 2', price: 3150000, size: 1245, beds: 2, baths: 3, featured: PIMG + 'prop-waterfront-apartment.webp', images: [PIMG + 'prop-waterfront-apartment.webp', PIMG + 'int-living-3.webp', PIMG + 'int-kitchen-1.webp'], description: 'Corner unit on a mid floor with a wraparound balcony, built-in wardrobes and one covered parking space. Full marina views from the living room and master bedroom.', status: 'published', highlights: ['Marina view', 'Corner unit'], display: { visible: true, portfolioFeatured: true, contact: 'any' }, age: 3 }),
  L({ id: 'seed-broker-seapoint-penthouse', title: '4-bedroom beachfront penthouse, off-plan', purpose: 'sale', type: 'Penthouse', completion: 'offplan', area: 'Dubai Marina', community: 'Seapoint Residences', price: 14900000, size: 3980, beds: 4, baths: 5, parking: 2, featured: PIMG + 'prop-penthouse.webp', description: 'Full-floor penthouse with a private pool terrace and direct beach access. 60/40 payment plan with handover in Q4 2027.', status: 'published', display: { visible: true, portfolioFeatured: true, contact: 'any' }, offplan: { project: 'Seapoint Residences', developer: 'Demo Developments', handover: 'Q4 2027', plan: [] }, age: 6 }),
  L({ id: 'seed-broker-creek-waters', title: '1-bedroom off-plan apartment on Dubai Creek waterfront', purpose: 'sale', type: 'Apartment', completion: 'offplan', area: 'Dubai Creek Harbour', community: 'Creek Waters 2', price: 1480000, size: 742, beds: 1, baths: 1, featured: PIMG + 'prop-creek-towers.webp', description: 'Launch-phase unit with a 60/40 payment plan and views over the Creek Tower plaza.', status: 'published', offplan: { project: 'Creek Waters 2', developer: 'Demo Developments', handover: 'Q2 2028', plan: [] }, age: 8 }),
  L({ id: 'seed-broker-bay-square-studio', title: 'Furnished studio for rent in Business Bay', purpose: 'rent', type: 'Apartment', area: 'Business Bay', community: 'Bay Square 5', price: 78000, size: 455, beds: 0, baths: 1, featured: PIMG + 'prop-canal-residences.webp', description: 'Fully furnished studio with canal glimpses, available from next month on a 12-month contract.', status: 'published', age: 12 }),
  L({ id: 'seed-broker-act-one', title: '3-bedroom apartment overlooking the Burj Khalifa', purpose: 'sale', type: 'Apartment', area: 'Downtown Dubai', community: 'Act One | Act Two', price: 5400000, size: 1890, beds: 3, baths: 4, parking: 2, featured: PIMG + 'downtown-boulevard.webp', description: 'Upgraded kitchen, maid’s room and two parking spaces, a short walk from Dubai Opera.', status: 'published', age: 15 }),
  L({ id: 'seed-broker-lake-terrace', title: '1-bedroom apartment in Jumeirah Lake Towers', purpose: 'sale', type: 'Apartment', area: 'Jumeirah Lake Towers', community: 'Lake Terrace', price: 1190000, size: 860, beds: 1, baths: 2, featured: PIMG + 'jlt-night.webp', description: 'Lake-facing unit, tenanted until June 2027 — a ready income investment.', status: 'published', age: 20 }),
  L({ id: 'seed-broker-sold-marina', title: '2-bedroom apartment, Dubai Marina', purpose: 'sale', type: 'Apartment', area: 'Dubai Marina', community: 'Marina Gate 1', price: 2350000, size: 1180, beds: 2, baths: 2, featured: PIMG + 'marina-night.webp', description: 'Sold to an overseas buyer after remote viewings.', status: 'sold', age: 60 }),
  L({ id: 'seed-broker-sold-downtown', title: '3-bedroom apartment, Downtown Dubai', purpose: 'sale', type: 'Apartment', area: 'Downtown Dubai', community: 'The Address Residences', price: 5600000, size: 1960, beds: 3, baths: 4, featured: PIMG + 'int-dining-1.webp', description: 'Sold within three weeks of listing.', status: 'sold', age: 90 }),
  L({ id: 'seed-broker-rented-bay', title: 'Studio, Business Bay', purpose: 'rent', type: 'Apartment', area: 'Business Bay', community: 'DAMAC Maison', price: 72000, size: 430, beds: 0, baths: 1, featured: PIMG + 'int-bedroom-1.webp', description: 'Let on a 12-month contract.', status: 'rented', age: 40 }),
  L({ id: 'seed-broker-draft-jvc', title: 'Draft — 2-bedroom townhouse (not public)', purpose: 'sale', type: 'Townhouse', area: 'Jumeirah Village Circle', community: 'Garden District', price: 2450000, size: 2100, beds: 2, baths: 3, featured: PIMG + 'prop-townhouse.webp', description: 'Draft listing used to test that unpublished properties stay private.', status: 'draft', age: 1 }),
];

/* ---------------------------------------------------------------- agency */
const AGENCY_EMAIL = 'agency@testmail.com';
const AGENCY = { name: 'GoodLife Real Estate', slug: 'goodlife-real-estate-demo' };
const agencyPortfolio = {
  slug: 'goodlife-real-estate-demo',
  displayName: AGENCY.name,
  title: 'Real Estate Agency',
  headline: 'Villas, waterfront homes and leasing across Dubai',
  intro: 'A Dubai brokerage founded in 2014, with sales, off-plan and leasing teams covering Palm Jumeirah, Dubai Marina, Dubai Hills Estate and the villa communities.',
  location: 'Business Bay, Dubai, UAE',
  founded: '2014',
  photo: '/images/profile/logo-goodlife.svg',
  bio: 'GoodLife Real Estate is a mid-sized Dubai brokerage with separate teams for prime sales, off-plan advisory and residential leasing. Each client works with one named consultant, supported by an in-house conveyancing coordinator.',
  history: 'Founded in 2014 with three consultants in a Jumeirah Lake Towers office, GoodLife moved to Business Bay in 2019 and added a dedicated leasing division in 2021.',
  approach: 'Give every client one accountable consultant, written market evidence for every recommendation, and a clear timeline from offer to transfer.',
  services: ['Residential sales', 'Off-plan advisory', 'Residential leasing', 'Commercial leasing', 'Property management referrals'],
  specialties: ['Luxury Villas', 'Waterfront Apartments', 'Off-Plan Properties', 'Residential Leasing'],
  whyPoints: [
    { icon: 'geo-alt', title: 'Dubai Property Expertise', desc: 'Strong familiarity with Dubai’s residential and investment property markets.' },
    { icon: 'people', title: 'Experienced Consultants', desc: 'A team of dedicated professionals providing reliable property guidance.' },
    { icon: 'shield-check', title: 'Trusted Client Relationships', desc: 'Building lasting partnerships through transparent communication.' },
    { icon: 'clipboard-check', title: 'Complete Real Estate Support', desc: 'Supporting customers throughout buying, selling, and renting.' },
  ],
  areas: ['Palm Jumeirah', 'Dubai Marina', 'Dubai Hills Estate', 'Arabian Ranches', 'Business Bay', 'Emaar Beachfront'],
  areaMeta: {
    'Palm Jumeirah': { primary: true, note: 'Prime villas and beach-access homes.' },
    'Dubai Marina': { primary: true, note: 'Resale apartments and new waterfront launches.' },
    'Dubai Hills Estate': { primary: true, note: 'Apartments and villas for sale and lease.' },
    'Arabian Ranches': { primary: false, note: '' },
    'Business Bay': { primary: false, note: 'Head office location; commercial leasing.' },
    'Emaar Beachfront': { primary: false, note: '' },
  },
  credentials: [{ label: 'ISO 9001 Quality Management', issuer: 'Bureau Veritas', value: 'BV-ISO-77120', expires: '2027-09-30', verified: true }],
  publicEmail: AGENCY_EMAIL,
  publicPhone: '+971 4 000 7700',
  whatsapp: '+971 50 000 7700',
  preferred: 'call',
  address: 'Office 1204, Bay Gate Tower, Business Bay, Dubai',
  website: 'https://goodlife-realestate.example.com',
  socials: [
    { platform: 'Instagram', url: 'https://www.instagram.com/example.goodlife.re' },
    { platform: 'LinkedIn', url: 'https://www.linkedin.com/company/example-goodlife-real-estate' },
    { platform: 'Facebook', url: 'https://www.facebook.com/example.goodlife.re' },
    { platform: 'YouTube', url: 'https://www.youtube.com/@example-goodlife' },
  ],
  reviewSources: [
    { platform: 'Google Reviews', url: 'https://www.google.com/maps/search/?api=1&query=GoodLife+Real+Estate+Dubai' },
    { platform: 'Bayut', url: 'https://www.bayut.com/companies/' },
    { platform: 'Trustpilot', url: 'https://www.trustpilot.com/' },
  ],
  achievements: [
    { id: 'ac-seed-a1', kind: 'Notable transaction', title: 'Off-market Palm Jumeirah villa sale', detail: 'Completed with two remote viewings for an overseas buyer.', date: '2026-07', evidence: 'Transfer document on file', approved: true },
    { id: 'ac-seed-a2', kind: 'Professional award', title: 'Best Mid-Sized Brokerage — Dubai 2025', detail: 'Awarded for client satisfaction and transaction volume.', date: '2025-11', evidence: 'Award certificate uploaded', approved: true },
  ],
  teamMeta: {},
  includeTeam: true,
  defaultSort: 'featured',
  showClosed: true,
  featuredOrder: ['seed-agency-palm-villa'],
  isPublic: true,
  searchable: true,
  indexable: true,
  showSocials: true,
  contactMode: 'all',
  cover: '/images/profile/cover-agency.svg',
  coverPos: 50,
  updatedAt: now,
  publishedAt: now,
};
const agencyListings = (agencyId: number | string) => [
  L({ id: 'seed-agency-palm-villa', title: '5-bedroom signature villa on Palm Jumeirah', purpose: 'sale', type: 'Villa', area: 'Palm Jumeirah', community: 'Frond G', price: 38500000, size: 7200, beds: 5, baths: 6, parking: 3, featured: PIMG + 'palm-villas.webp', images: [PIMG + 'palm-villas.webp', PIMG + 'villa-pool.webp', PIMG + 'palm-aerial.webp'], description: 'Beach-access villa with private pool, upgraded interiors and Atlantis views.', status: 'published', display: { visible: true, portfolioFeatured: true, contact: 'any' }, amenities: ['Private pool', 'Private garden', 'Beach access'], age: 4 }),
  L({ id: 'seed-agency-beachfront', title: '2-bedroom off-plan apartment in Emaar Beachfront', purpose: 'sale', type: 'Apartment', completion: 'offplan', area: 'Emaar Beachfront', community: 'Beachgate', price: 3600000, size: 1150, beds: 2, baths: 2, featured: PIMG + 'prop-jumeirah-waterfront.webp', description: 'Sea-view launch unit with a 70/30 payment plan.', status: 'published', offplan: { project: 'Beachgate', developer: 'Demo Developments', handover: 'Q3 2027', plan: [] }, age: 7 }),
  L({ id: 'seed-agency-ranches-villa', title: '4-bedroom family villa in Arabian Ranches', purpose: 'sale', type: 'Villa', area: 'Arabian Ranches', community: 'Saheel', price: 6900000, size: 4300, beds: 4, baths: 5, parking: 2, featured: PIMG + 'prop-villa.webp', description: 'Backs onto the park, extended kitchen, close to schools.', status: 'published', age: 9 }),
  L({ id: 'seed-agency-hills-rent', title: '1-bedroom apartment for rent in Dubai Hills Estate', purpose: 'rent', type: 'Apartment', area: 'Dubai Hills Estate', community: 'Park Heights 2', price: 110000, size: 780, beds: 1, baths: 1, featured: PIMG + 'prop-courtyard-residences.webp', description: 'Park-facing unit, unfurnished, available now.', status: 'published', age: 11 }),
  L({ id: 'seed-agency-marina-apartment', title: '3-bedroom apartment in Dubai Marina', purpose: 'sale', type: 'Apartment', area: 'Dubai Marina', community: 'Emaar 6 Towers', price: 4250000, size: 1720, beds: 3, baths: 4, featured: PIMG + 'prop-marina-interior.webp', description: 'Full marina view, upgraded flooring.', status: 'published', age: 14 }),
  L({ id: 'seed-agency-bay-office', title: 'Full-floor office in Business Bay', purpose: 'rent', type: 'Office', category: 'commercial', area: 'Business Bay', community: 'Bay Gate', price: 720000, size: 5400, beds: 0, baths: 2, parking: 8, featured: PIMG + 'prop-office.webp', description: 'Fitted office with canal views and eight parking bays.', status: 'published', amenities: ['Fitted', 'Reception', 'Covered parking'], age: 18 }),
  L({ id: 'seed-agency-sold-palm', title: '6-bedroom villa, Palm Jumeirah', purpose: 'sale', type: 'Villa', area: 'Palm Jumeirah', community: 'Frond C', price: 41000000, size: 8100, beds: 6, baths: 7, featured: PIMG + 'palm-aerial.webp', description: 'Sold off-market.', status: 'sold', age: 120 }),
  L({ id: 'seed-agency-rented-hills', title: '2-bedroom apartment, Dubai Hills Estate', purpose: 'rent', type: 'Apartment', area: 'Dubai Hills Estate', community: 'Collective 2.0', price: 135000, size: 1010, beds: 2, baths: 2, featured: PIMG + 'int-bedroom-2.webp', description: 'Let on a 12-month contract.', status: 'rented', age: 70 }),
].map((l) => ({ ...l, ownerType: 'agency', ownerAgency: agencyId }));

/* ---------------------------------------------------------------- run */
/** syncMemberProperties deletes owned listings that aren't passed in, so keep the account's existing listings
 * and add (or refresh) the seeded ones alongside them. */
async function seedListings(payload: any, memberId: number, seeds: any[]) {
  const existing = await payload.find({ collection: 'properties', where: { 'appData.ownerMemberId': { equals: memberId } }, pagination: false, depth: 0, overrideAccess: true });
  const listings = (existing.docs as any[]).map(listingFromProperty).filter((l: any) => !seeds.some((x) => x.id === l.id));
  await syncMemberProperties(payload, memberId, { listings: [...listings, ...seeds] });
  return listings.length;
}
async function upsertMember(payload: any, email: string, password: string, data: any, plan: string) {
  const found = await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true });
  const existing: any = found.docs[0];
  if (existing) {
    const profile = { ...(existing.profile || {}), ...data.profile };
    delete profile.portfolioDraft; // show the seeded profile, not an old draft
    return payload.update({ collection: 'members', id: existing.id, data: { ...data, profile, password }, overrideAccess: true });
  }
  return payload.create({ collection: 'members', data: { ...data, email, password, plan }, overrideAccess: true });
}

async function main() {
  const brokerPassword = process.env.SEED_BROKER_PASSWORD || process.env.DEMO_BROKER_PASSWORD || '';
  const agencyPassword = process.env.SEED_AGENCY_PASSWORD || process.env.DEMO_AGENCY_PASSWORD || '';
  if (brokerPassword.length < 8 || agencyPassword.length < 8) throw new Error('Set SEED_BROKER_PASSWORD and SEED_AGENCY_PASSWORD (8+ characters).');

  const payload = await getPayload({ config: await configPromise });

  /* broker */
  const broker: any = await upsertMember(payload, BROKER_EMAIL, brokerPassword, {
    name: 'Aisha Rahman',
    accountType: 'broker',
    mobile: '+971500004821',
    credentialStatus: 'verified',
    adminCreated: false,
    adminAccess: false,
    profile: {
      portfolio: brokerPortfolio,
      credentials: { fullName: 'Aisha Rahman', brn: '48213', expiry: '2027-03-31' },
      privacy: { showPhone: true, showEmail: true, showWhatsapp: true, showBrn: true, showLanguages: true, showExperience: true, showTransactions: true },
      notifications: { enquiries: true, network: true, selection: true, billing: true, product: false },
      prefs: { language: 'English', currency: 'AED', contact: 'whatsapp' },
    },
  }, 'broker-bronze');
  const keptBroker = await seedListings(payload, Number(broker.id), brokerListings);
  await syncMemberBroker(payload, await payload.findByID({ collection: 'members', id: broker.id, depth: 0, overrideAccess: true }));
  console.log(`Broker seeded: ${BROKER_EMAIL} → /brokers/${brokerPortfolio.slug} (${brokerListings.length} seeded listings, ${keptBroker} existing kept)`);

  /* agency: reuse the agency it already administers, otherwise create one */
  const existingAgency = await payload.find({ collection: 'members', where: { email: { equals: AGENCY_EMAIL } }, limit: 1, depth: 0, overrideAccess: true });
  const linkedId = (existingAgency.docs[0] as any)?.profile?.agency?.agencyId;
  const agencyDoc = {
    name: AGENCY.name,
    licenseNumber: '30418',
    description: agencyPortfolio.intro,
    location: 'Business Bay, Dubai',
    phone: agencyPortfolio.publicPhone,
    email: AGENCY_EMAIL,
    website: agencyPortfolio.website,
    social: { instagram: agencyPortfolio.socials[0].url, linkedin: agencyPortfolio.socials[1].url, facebook: agencyPortfolio.socials[2].url },
    verified: true,
  };
  let agency: any = linkedId ? await payload.findByID({ collection: 'agencies', id: linkedId, depth: 0, overrideAccess: true }).catch(() => null) : null;
  if (!agency) {
    const bySlug = await payload.find({ collection: 'agencies', where: { slug: { equals: AGENCY.slug } }, limit: 1, depth: 0, overrideAccess: true });
    agency = bySlug.docs[0] || null;
  }
  agency = agency
    ? await payload.update({ collection: 'agencies', id: agency.id, data: agencyDoc, overrideAccess: true })
    : await payload.create({ collection: 'agencies', data: { ...agencyDoc, slug: AGENCY.slug }, overrideAccess: true });

  const agencyMember: any = await upsertMember(payload, AGENCY_EMAIL, agencyPassword, {
    name: AGENCY.name,
    accountType: 'agency',
    mobile: '+971500007700',
    credentialStatus: 'verified',
    adminCreated: false,
    adminAccess: false,
    profile: {
      legalName: 'GoodLife Real Estate LLC',
      agency: { agencyId: agency.id, agencyRole: 'agency_admin', name: AGENCY.name, slug: agency.slug },
      portfolio: agencyPortfolio,
      credentials: { orn: '30418', tradeLicence: '771204', licenceFile: 'goodlife-trade-licence.pdf' },
      privacy: { showPhone: true, showEmail: true, showWhatsapp: true, showBrn: true, showTransactions: true },
      notifications: { enquiries: true, network: true, selection: true, billing: true, product: false },
      prefs: { language: 'English', currency: 'AED', contact: 'call' },
    },
  }, 'agency-silver');
  const keptAgency = await seedListings(payload, Number(agencyMember.id), agencyListings(agency.id));
  await syncMemberBroker(payload, await payload.findByID({ collection: 'members', id: agencyMember.id, depth: 0, overrideAccess: true }));
  console.log(`Agency seeded: ${AGENCY_EMAIL} → /agencies/${agency.slug} (${agencyListings(agency.id).length} seeded listings, ${keptAgency} existing kept)`);

  await payload.destroy?.();
  process.exit(0);
}

main().catch((error) => {
  console.error('Profile test-data seed failed:', error);
  process.exit(1);
});
