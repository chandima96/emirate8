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
  pending: { label: 'Pending review', cls: 'badge-warn', public: false },
  published: { label: 'Published', cls: 'badge-ok', public: true },
  unpublished: { label: 'Unpublished', cls: 'badge-muted', public: false },
  sold: { label: 'Sold', cls: 'badge-dark', public: false },
  rented: { label: 'Rented', cls: 'badge-dark', public: false },
  archived: { label: 'Archived', cls: 'badge-muted', public: false },
};
export const LEGACY_STATUS = { active: 'published', paused: 'unpublished', review: 'pending' };

export const USD_PEG = 3.6725; // the UAE dirham is pegged to the US dollar
