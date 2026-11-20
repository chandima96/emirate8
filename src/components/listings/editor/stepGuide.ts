/* Short rail hints and side-panel tips for each listing-editor step, keyed by step name. */

export const STEP_HINTS: Record<string, string> = {
  Classification: 'Purpose, type & market',
  Location: 'Area, building & map',
  'Property details': 'Size, layout & amenities',
  'Price & terms': 'Price, charges & payments',
  Marketing: 'Title, description & highlights',
  'Photos & media': 'Photos, video & documents',
  'Permit & display': 'Permit, licence & contact',
  'Team member': 'Assign a broker',
  'Review & publish': 'Check and go live',
};

export const STEP_TIPS: Record<string, { title: string; tips: string[] }> = {
  Classification: {
    title: 'Start with the basics',
    tips: [
      'Choose the purpose and property type first. Later steps only ask the questions that apply.',
      'Off-plan and ready properties ask for different price and payment details.',
      'Add your CRM reference so you can match enquiries back to your own system.',
    ],
  },
  Location: {
    title: 'Help buyers find it',
    tips: [
      'Use the building or project name buyers actually search for.',
      'Place the map pin on the building itself, not the middle of the community.',
      'If the owner prefers privacy, show the public location less precisely.',
    ],
  },
  'Property details': {
    title: 'Be precise',
    tips: [
      'Take the size from the title deed or SPA so price per area is accurate.',
      'Tick the amenities buyers filter by, such as parking, pool and views.',
      'Only the sections that fit this property type are shown.',
    ],
  },
  'Price & terms': {
    title: 'Show the real cost',
    tips: [
      'Include service charges so buyers see the true yearly cost.',
      'For off-plan, enter the payment plan exactly as the developer publishes it.',
      'For rentals, state how many cheques you accept.',
    ],
  },
  Marketing: {
    title: 'Make it stand out',
    tips: [
      'Lead the title with what makes this unit different: view, layout or upgrades.',
      'Keep the description scannable with short paragraphs and a few highlights.',
      'An Arabic version reaches more buyers across the UAE.',
    ],
  },
  'Photos & media': {
    title: 'Photos sell the listing',
    tips: [
      'Put your strongest landscape photo first and make it the cover.',
      'Show every room, then the view, the building and its amenities.',
      'A floor plan answers the layout question before the first call.',
    ],
  },
  'Permit & display': {
    title: 'Stay compliant',
    tips: [
      'Enter the advertising permit exactly as issued. It is reviewed before the listing goes live.',
      'Check the licence and contact details that buyers will see.',
      'Keep the marketing authorization and its expiry date up to date.',
    ],
  },
  'Team member': {
    title: 'Who handles enquiries',
    tips: [
      'The assigned broker handles this listing and its enquiries.',
      'You can leave it unassigned and assign it later.',
    ],
  },
  'Review & publish': {
    title: 'Before you publish',
    tips: [
      'Open Preview to see the page exactly as buyers will.',
      'Fix anything flagged in the summary. Each item links back to its field.',
      'Read the declarations carefully: they cover media rights and owner authorization.',
    ],
  },
};
