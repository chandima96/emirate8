/* Reference data: plans, locations, property types, amenities, statuses. */

import { PLAN_CATALOG } from './plans';

export const PLANS = PLAN_CATALOG;

export const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Umm Al Quwain', 'Fujairah'];
export const AREAS = {
  Dubai: [
    'Downtown Dubai',
    'Dubai Marina',
    'Palm Jumeirah',
    'Business Bay',
    'Dubai Hills Estate',
    'Dubai Creek Harbour',
    'Jumeirah',
    'Jumeirah Village Circle',
    'Jumeirah Lake Towers',
    'Arabian Ranches',
    'Al Barari',
    'City Walk',
    'Meydan',
    'Dubai South',
  ],
  'Abu Dhabi': ['Saadiyat Island', 'Al Reem Island', 'Yas Island', 'Al Raha Beach'],
  Sharjah: ['Al Majaz', 'Aljada', 'Al Khan'],
  Ajman: ['Al Nuaimiya', 'Ajman Downtown'],
  'Ras Al Khaimah': ['Al Marjan Island', 'Mina Al Arab'],
  'Umm Al Quwain': ['UAQ Marina'],
  Fujairah: ['Fujairah City'],
};
/**
 * Fuller community list for the listing editor's location step (names only — no coordinates or
 * boundaries are implied). `AREAS` stays the short list used by search filters.
 */
export const COMMUNITIES: Record<string, string[]> = {
  Dubai: [
    ...AREAS.Dubai,
    'Al Barsha', 'Al Furjan', 'Al Garhoud', 'Al Jaddaf', 'Al Khail Heights', 'Al Kifaf', 'Al Mankhool', 'Al Mizhar',
    'Al Nahda', 'Al Quoz', 'Al Qusais', 'Al Safa', 'Al Satwa', 'Al Sufouh', 'Al Warqa', 'Al Wasl', 'Arabian Ranches 2',
    'Arabian Ranches 3', 'Arjan', 'Barsha Heights', 'Bluewaters Island', 'Bur Dubai', 'Culture Village', 'DAMAC Hills',
    'DAMAC Hills 2', 'DAMAC Lagoons', 'Deira', 'DIFC', 'Discovery Gardens', 'Dubai Festival City', 'Dubai Harbour',
    'Dubai Healthcare City', 'Dubai Internet City', 'Dubai Investments Park', 'Dubai Islands', 'Dubai Maritime City',
    'Dubai Media City', 'Dubai Production City', 'Dubai Science Park', 'Dubai Silicon Oasis', 'Dubai Sports City',
    'Dubai Studio City', 'Dubailand', 'Emaar Beachfront', 'Emaar South', 'Emirates Hills', 'Expo City Dubai',
    'Green Community', 'International City', 'Jebel Ali', 'Jumeirah Bay Island', 'Jumeirah Beach Residence',
    'Jumeirah Golf Estates', 'Jumeirah Heights', 'Jumeirah Islands', 'Jumeirah Park', 'Jumeirah Village Triangle',
    'Karama', 'La Mer', 'Living Legends', 'Majan', 'Mina Rashid', 'Mirdif', 'Mohammed Bin Rashid City', 'Motor City',
    'Mudon', 'Nad Al Sheba', 'Oud Metha', 'Palm Jebel Ali', 'Pearl Jumeirah', 'Port de La Mer', 'Ras Al Khor',
    'Remraam', 'Serena', 'Sheikh Zayed Road', 'Sobha Hartland', 'The Greens', 'The Lakes', 'The Meadows', 'The Oasis',
    'The Springs', 'The Valley', 'The Views', 'The World Islands', 'Tilal Al Ghaf', 'Town Square', 'Trade Centre',
    'Umm Suqeim', 'Villanova', 'Wadi Al Safa', 'Zaabeel',
  ],
  'Abu Dhabi': [
    ...AREAS['Abu Dhabi'],
    'Al Bateen', 'Al Ghadeer', 'Al Hudayriat Island', 'Al Jubail Island', 'Al Khalidiya', 'Al Maryah Island',
    'Al Mushrif', 'Al Raha Gardens', 'Al Reef', 'Al Shamkha', 'Corniche Area', 'Hydra Village', 'Khalifa City',
    'Masdar City', 'Mohammed Bin Zayed City', 'Ramhan Island',
  ],
  Sharjah: [
    ...AREAS.Sharjah,
    'Al Mamzar', 'Al Nahda', 'Al Qasimia', 'Al Taawun', 'Al Tai', 'Al Zahia', 'Hoshi', 'Maryam Island', 'Muwaileh',
    'Sharjah Waterfront City', 'Tilal City',
  ],
  Ajman: [
    ...AREAS.Ajman,
    'Al Amerah', 'Al Helio', 'Al Jurf', 'Al Mowaihat', 'Al Rashidiya', 'Al Rawda', 'Al Yasmeen', 'Al Zorah', 'Emirates City',
  ],
  'Ras Al Khaimah': [...AREAS['Ras Al Khaimah'], 'Al Hamra Village', 'Al Nakheel', 'Dafan Al Nakheel', 'Julphar'],
  'Umm Al Quwain': [...AREAS['Umm Al Quwain'], 'Al Raas', 'Al Salamah'],
  Fujairah: [...AREAS.Fujairah, 'Al Faseel', 'Dibba'],
};
export const TYPES = {
  residential: ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Hotel apartment', 'Residential building'],
  commercial: ['Office', 'Shop / Retail', 'Showroom', 'Warehouse', 'Commercial villa', 'Commercial building', 'Factory', 'Labour accommodation', 'Retail'],
  land: ['Residential plot', 'Commercial plot', 'Industrial plot', 'Mixed-use plot', 'Plot'],
};
export const AMENITY_GROUPS = {
  Interior: [
    'Built-in wardrobes',
    'Walk-in closet',
    'Maid’s room',
    'Study',
    'Central A/C',
    'Kitchen appliances',
    'Storage room',
    'Laundry room',
  ],
  Building: ['Concierge', 'Lobby', 'Elevators', 'Shared gym', 'Shared pool', 'Business centre', 'Children’s play area'],
  Outdoor: ['Balcony', 'Terrace', 'Private garden', 'Private pool', 'BBQ area', 'Beach access'],
  Wellness: ['Spa', 'Sauna', 'Steam room', 'Jogging track', 'Tennis court'],
  Security: ['24-hour security', 'CCTV', 'Gated community', 'Intercom'],
  Parking: ['Covered parking', 'Visitor parking', 'EV charging'],
  Community: ['Park nearby', 'Retail nearby', 'Schools nearby', 'Metro nearby', 'Pets allowed', 'Mosque nearby'],
};
export const CATEGORY_AMENITY_GROUPS = {
  residential: {
    Interior: AMENITY_GROUPS.Interior,
    Building: AMENITY_GROUPS.Building,
    Outdoor: AMENITY_GROUPS.Outdoor,
    Wellness: AMENITY_GROUPS.Wellness,
    Security: AMENITY_GROUPS.Security,
    Parking: AMENITY_GROUPS.Parking,
    Community: AMENITY_GROUPS.Community,
  },
  commercial: {
    Fitout: ['Fitted', 'Shell and core', 'Partitioned', 'Meeting rooms', 'Reception area', 'Raised flooring'],
    Building: ['Lobby', 'Elevators', 'Business centre', '24-hour access', 'Security desk'],
    Facilities: ['Central A/C', 'CCTV', 'Loading access', 'Retail frontage', 'Signage opportunity'],
    Parking: ['Covered parking', 'Visitor parking', 'EV charging', 'Parking ratio available'],
  },
};
export const AMENITIES = [].concat.apply(
  [],
  Object.keys(AMENITY_GROUPS).map(function (k) {
    return AMENITY_GROUPS[k];
  }),
);
export const HIGHLIGHTS = [
  'Burj Khalifa view',
  'Sea view',
  'Marina view',
  'Canal view',
  'Golf view',
  'Park view',
  'Waterfront',
  'Furnished',
  'Vacant on transfer',
  'Corner unit',
  'High floor',
  'Private pool',
  'Brand new',
  'Upgraded',
  'Payment plan',
  'Near metro',
];
export const MAX_HIGHLIGHTS = 6;

export const STATUS = {
  draft: { label: 'Draft', cls: 'badge-muted', public: false },
  pending: { label: 'Awaiting verification', cls: 'badge-warn', public: false },
  published: { label: 'Published', cls: 'badge-ok', public: true },
  unpublished: { label: 'Unpublished', cls: 'badge-muted', public: false },
  sold: { label: 'Sold', cls: 'badge-dark', public: false },
  rented: { label: 'Rented', cls: 'badge-dark', public: false },
  archived: { label: 'Archived', cls: 'badge-muted', public: false },
};
export const LEGACY_STATUS = { active: 'published', paused: 'unpublished', review: 'pending' };

export const USD_PEG = 3.6725; // the UAE dirham is pegged to the US dollar
