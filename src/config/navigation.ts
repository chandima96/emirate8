/* Navigation content — every link points to a real route. */

export const MEGA = {
  buy: {
    label: 'Buy',
    groups: [
      {
        title: 'Buy a property',
        cols: [
          [
            'Browse',
            [
              ['Properties for sale', '/properties?purpose=sale'],
              ['Featured properties', '/properties?purpose=sale&sort=featured'],
              ['Off-plan properties', '/properties?purpose=sale&completion=offplan'],
            ],
          ],
          [
            'Search',
            [
              ['Search by location', '/properties?purpose=sale'],
              ['Downtown Dubai', '/properties?purpose=sale&q=Downtown%20Dubai'],
              ['Dubai Marina', '/properties?purpose=sale&q=Dubai%20Marina'],
              ['Palm Jumeirah', '/properties?purpose=sale&q=Palm%20Jumeirah'],
            ],
          ],
        ],
      },
      {
        title: 'Get help',
        cols: [
          [
            'Professionals',
            [
              ['Find a buyer’s agent', '/agents'],
              ['Find an agency', '/agents?view=agencies'],
              ['Saved properties', '/saved'],
            ],
          ],
        ],
      },
    ],
  },
  rent: {
    label: 'Rent',
    groups: [
      {
        title: 'Rent a property',
        cols: [
          [
            'Browse',
            [
              ['Properties for rent', '/properties?purpose=rent'],
              ['Featured rentals', '/properties?purpose=rent&sort=featured'],
              ['Commercial for rent', '/properties?purpose=rent&type=Office'],
            ],
          ],
          [
            'Search',
            [
              ['Search by location', '/properties?purpose=rent'],
              ['Downtown Dubai', '/properties?purpose=rent&q=Downtown%20Dubai'],
              ['Dubai Hills Estate', '/properties?purpose=rent&q=Dubai%20Hills%20Estate'],
              ['Business Bay', '/properties?purpose=rent&q=Business%20Bay'],
            ],
          ],
        ],
      },
      {
        title: 'Get help',
        cols: [
          [
            'Professionals',
            [
              ['Rental agents', '/agents'],
              ['Rental agencies', '/agents?view=agencies'],
            ],
          ],
        ],
      },
    ],
  },
  sell: {
    label: 'Sell',
    groups: [
      {
        title: 'Sell a property',
        cols: [
          [
            'Get started',
            [
              ['List your property', '/sell'],
              ['Find a selling agent', '/agents'],
              ['Compare agencies', '/agents?view=agencies'],
            ],
          ],
          [
            'Learn',
            [
              ['Selling guide', '/sell#guide'],
              ['Owner waitlist', '/sell#waitlist'],
              ['Help & FAQs', '/help'],
            ],
          ],
        ],
      },
    ],
  },
  agent: {
    label: 'Find an Agent',
    groups: [
      {
        title: 'Find a professional',
        cols: [
          [
            'Agents',
            [
              ['All agents', '/agents'],
              ['Search by location', '/agents#search'],
              ['Featured agents', '/agents#results'],
            ],
          ],
          [
            'Agencies',
            [
              ['All agencies', '/agents?view=agencies'],
              ['Agency profiles', '/agents?view=agencies#results'],
            ],
          ],
        ],
      },
    ],
  },
  pros: {
    label: 'For Professionals',
    groups: [
      {
        title: 'Looking for pros?',
        cols: [
          [
            'Find professionals',
            [
              ['Find real estate agents', '/agents'],
              ['Find real estate agencies', '/agents?view=agencies'],
              ['Explore agent profiles', '/brokers/omar-haddad'],
              ['Browse broker portfolios', '/agents#results'],
            ],
          ],
        ],
      },
      {
        title: 'I’m a pro',
        cols: [
          [
            'I’m a professional',
            [
              ['Agent solutions', '/for-professionals'],
              ['Create an agent account', '/register?type=broker'],
              ['Create a brokerage account', '/register?type=agency'],
              ['Manage my listings', '/listings'],
              ['My professional dashboard', '/dashboard'],
            ],
          ],
          [
            'Professional resources',
            [
              ['Agent profile guide', '/for-professionals#profile'],
              ['Listing management', '/for-professionals#listings'],
              ['Broker resources', '/platform'],
              ['Account support', '/help#contact'],
            ],
          ],
        ],
      },
    ],
  },
};
export const LEFT_MENUS = ['buy', 'rent', 'sell', 'agent'];

export const RAIL_BUYER = [
  { icon: 'search', label: 'Search', href: '/properties', key: 'search' },
  { icon: 'heart', label: 'Saved', href: '/saved', key: 'saved' },
  { icon: 'clock', label: 'Recent', href: '/saved#recent', key: 'recent' },
  { icon: 'chat-square-text', label: 'Enquiries', href: '/saved#enquiries', key: 'enquiries' },
];
export const RAIL_BROKER = [
  { icon: 'grid-1x2', label: 'Dashboard', href: '/dashboard', key: 'dashboard' },
  { icon: 'buildings', label: 'My Listings', href: '/listings', key: 'listings' },
  { icon: 'inbox', label: 'Enquiries', href: '/enquiries', key: 'inbox' },
  { icon: 'person-badge', label: 'Profile', href: '/profile', key: 'profile' },
  { icon: 'gear', label: 'Account', href: '/account', key: 'account' },
];

export const WORKSPACE_NAV = [
  { label: 'Dashboard', href: '/dashboard', key: 'overview', icon: 'grid-1x2' },
  { label: 'My Listings', href: '/listings', key: 'listings', icon: 'buildings' },
  { label: 'Enquiries', href: '/enquiries', key: 'enquiries', icon: 'inbox' },
  { label: 'Profile', href: '/profile', key: 'profile', icon: 'person-badge' },
  { label: 'Account', href: '/account', key: 'account', icon: 'gear' },
];
export const WORKSPACE_NETWORK = [
  { label: 'Broker Network', href: '/network', key: 'network', icon: 'diagram-3' },
  { label: 'Developers Network', href: '/developer-network', key: 'developerNetwork', icon: 'building' },
  { label: 'Selected Properties', href: '/selected', key: 'selected', icon: 'bookmark' },
  { label: 'Subscription', href: '/subscription', key: 'subscription', icon: 'credit-card' },
];

export const FOOTER_COLUMNS: [string, [string, string][]][] = [
  [
    'Properties',
    [
      ['For sale', '/properties?purpose=sale'],
      ['For rent', '/properties?purpose=rent'],
      ['Off-plan', '/properties?completion=offplan'],
      ['Commercial', '/properties?type=Office'],
      ['Saved properties', '/saved'],
    ],
  ],
  [
    'Communities',
    [
      ['Downtown Dubai', '/properties?q=Downtown%20Dubai'],
      ['Dubai Marina', '/properties?q=Dubai%20Marina'],
      ['Palm Jumeirah', '/properties?q=Palm%20Jumeirah'],
      ['Business Bay', '/properties?q=Business%20Bay'],
      ['Dubai Hills Estate', '/properties?q=Dubai%20Hills%20Estate'],
    ],
  ],
  [
    'Professionals',
    [
      ['Find an agent', '/agents'],
      ['Find an agency', '/agents?view=agencies'],
      ['For professionals', '/for-professionals'],
      ['Create an account', '/register'],
      ['Sign in', '/login'],
    ],
  ],
  [
    'Company',
    [
      ['Selling guide', '/sell#guide'],
      ['Help & contact', '/help'],
      ['Platform overview', '/platform'],
      ['Terms of Service', '/terms'],
      ['Privacy Policy', '/privacy'],
    ],
  ],
];
