/* Broker profile model shared by the profile dashboard, the public broker page, the preview and the
 * server mappers. Ported from UI_Changes/emirate8-page-updates (profile-builder.js, public-profiles.js,
 * visibility-testing.js). The whole profile lives in `user.portfolio` (draft: `user.portfolioDraft`);
 * this file only adds the fields that release introduced and never invents data. Pure — no React, no store. */

export const DEFAULT_BROKER_COVER = '/images/profile/cover-broker.svg';
export const DEFAULT_AGENCY_COVER = '/images/profile/cover-agency.svg';

export const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'X', 'Threads', 'Other'];
export const REVIEW_PLATFORMS = ['Google Reviews', 'Property Finder', 'Bayut', 'Trustpilot', 'Facebook Reviews', 'Other'];
export const WHY_ICONS: [string, string][] = [
  ['geo-alt', 'Location'], ['person-check', 'Person'], ['chat-dots', 'Conversation'], ['shield-check', 'Shield'],
  ['signpost-split', 'Guidance'], ['clipboard-check', 'Checklist'], ['graph-up-arrow', 'Growth'], ['key', 'Key'],
  ['people', 'Team'], ['award', 'Award'],
];
export const WHY_EXAMPLES: [string, string][] = [
  ['Local Market Expertise', 'In-depth knowledge of Dubai’s most sought-after residential communities.'],
  ['Personalised Property Guidance', 'Helping clients discover opportunities that match their needs and goals.'],
  ['Transparent Communication', 'Clear, reliable guidance throughout every stage of the property journey.'],
  ['End-to-End Support', 'Dedicated assistance from the first consultation to the final transaction.'],
];
export const WHY_EXAMPLES_AGENCY: [string, string][] = [
  ['Dubai Property Expertise', 'Strong familiarity with Dubai’s residential and investment property markets.'],
  ['Experienced Consultants', 'A team of dedicated professionals providing reliable property guidance.'],
  ['Trusted Client Relationships', 'Building lasting partnerships through transparent communication.'],
  ['Complete Real Estate Support', 'Supporting customers throughout buying, selling, and renting.'],
];
/** Agency-only settings for a team member, keyed by member id (role shown publicly, visibility, featured). */
export type TeamMeta = Record<string, { role?: string; visible?: boolean; featured?: boolean }>;
export const LANG_SUG = ['English', 'Arabic', 'Hindi', 'Urdu', 'French', 'Russian', 'Mandarin', 'German', 'Spanish', 'Persian', 'Tagalog'];
export const SPEC_SUG = ['Residential Sales', 'Waterfront Apartments', 'Off-Plan Properties', 'Luxury Villas', 'Residential Leasing', 'Commercial Leasing', 'Investment Apartments', 'Family Villas', 'Townhouses', 'Holiday Homes'];
export const CLIENT_SUG = ['First-time buyers', 'Relocating families', 'International investors', 'Upsizing homeowners', 'Landlords', 'Tenants', 'Corporate clients', 'Retirees'];
export const SERVICE_SUG = ['Buyer representation', 'Seller representation', 'Off-plan launch advisory', 'Resale price guidance', 'Viewing coordination', 'Mortgage and conveyancing referrals', 'Leasing and renewals', 'Property management referrals', 'Snagging inspection coordination'];
export const ACHIEVEMENT_KINDS = ['Professional award', 'Certificate', 'Notable transaction', 'Case study'];
export const SORTS: [string, string][] = [['featured', 'Featured first'], ['newest', 'Newest'], ['price-desc', 'Price: high to low'], ['price-asc', 'Price: low to high']];
export const PREFERRED_LABEL = { whatsapp: 'WhatsApp', call: 'Phone call', email: 'Email', form: 'Enquiry form' };

export type WhyPoint = { icon: string; title: string; desc: string };
export type ExperienceEntry = { id: string; agencyId?: string | null; agencyName: string; position: string; start: string; end: string; current: boolean; desc: string };
export type AreaMeta = Record<string, { primary?: boolean; note?: string }>;
export type Social = { platform: string; url: string };
export type ReviewSource = { platform: string; url: string };
export type Achievement = { id: string; kind: string; title: string; detail: string; date: string; evidence: string; approved: boolean };
export type Certification = { label: string; issuer?: string; value?: string; expires?: string; verified?: boolean };

/** The demo stored sort keys with hyphens; older portfolios used camelCase. */
export function normSort(s?: string) {
  return ({ priceDesc: 'price-desc', priceAsc: 'price-asc', relevant: 'featured' } as Record<string, string>)[s || ''] || (SORTS.some(([k]) => k === s) ? s! : 'featured');
}
export function uid(p: string) {
  return p + '-' + Math.random().toString(36).slice(2, 8);
}
export function blankWhy(): WhyPoint[] {
  return [0, 1, 2, 3].map((i) => ({ icon: WHY_ICONS[i][0], title: '', desc: '' }));
}

/** Adds the new fields (with defaults) to a portfolio/draft without touching existing values. */
export function withProfileDefaults<T extends Record<string, any>>(p: T): T {
  const d: any = p;
  d.location ??= '';
  d.journey ??= '';
  d.experienceEntries = Array.isArray(d.experienceEntries) ? d.experienceEntries : [];
  d.clients = Array.isArray(d.clients) ? d.clients : [];
  d.services = Array.isArray(d.services) ? d.services : [];
  d.whyPoints = Array.isArray(d.whyPoints) && d.whyPoints.length ? d.whyPoints.slice(0, 4) : blankWhy();
  while (d.whyPoints.length < 4) d.whyPoints.push({ icon: WHY_ICONS[d.whyPoints.length][0], title: '', desc: '' });
  d.approach ??= '';
  d.areaMeta = d.areaMeta && typeof d.areaMeta === 'object' ? d.areaMeta : {};
  d.booking ??= '';
  d.website ??= '';
  d.socials = Array.isArray(d.socials) ? d.socials : socialsFromLegacy(d.social);
  d.reviewSources = Array.isArray(d.reviewSources) ? d.reviewSources : [];
  d.achievements = Array.isArray(d.achievements) ? d.achievements : [];
  d.indexable = d.indexable !== false;
  d.showSocials = d.showSocials !== false;
  d.contactMode = d.contactMode === 'form' ? 'form' : 'all';
  // agency-only
  d.history ??= '';
  d.founded ??= '';
  d.address ??= '';
  d.teamMeta = d.teamMeta && typeof d.teamMeta === 'object' ? d.teamMeta : {};
  d.includeTeam = d.includeTeam !== false;
  d.defaultSort = normSort(d.defaultSort);
  return p;
}
function socialsFromLegacy(s: any): Social[] {
  if (!s || typeof s !== 'object') return [];
  const out: Social[] = [];
  if (s.instagram) out.push({ platform: 'Instagram', url: s.instagram });
  if (s.linkedin) out.push({ platform: 'LinkedIn', url: s.linkedin });
  return out;
}

/* ---------------- validation (same rules as the demo editor) ---------------- */
const SOCIAL_DOMAINS: Record<string, string> = { Instagram: 'instagram.com', Facebook: 'facebook.com', LinkedIn: 'linkedin.com', TikTok: 'tiktok.com', YouTube: 'youtube.com', X: 'x.com', Threads: 'threads.net' };
const REVIEW_DOMAINS: Record<string, RegExp> = { 'Google Reviews': /google\.|g\.page|goo\.gl/i, 'Property Finder': /propertyfinder\.ae/i, Bayut: /bayut\.com/i, Trustpilot: /trustpilot\.com/i, 'Facebook Reviews': /facebook\.com|fb\.com/i };
export function validUrl(u: string) {
  try {
    const x = new URL(u);
    return /^https?:$/.test(x.protocol) && /\./.test(x.hostname);
  } catch {
    return false;
  }
}
export function safeUrl(u?: string) {
  u = String(u || '').trim();
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : '';
}
export function socialErr(s: Social) {
  if (!s.url) return 'Add the profile URL, or remove this row.';
  if (!validUrl(s.url)) return 'Enter a full URL starting with https://';
  const d = SOCIAL_DOMAINS[s.platform];
  if (d && s.url.toLowerCase().indexOf(d) < 0 && !(s.platform === 'X' && /twitter\.com/i.test(s.url))) return 'This doesn’t look like a ' + s.platform + ' link.';
  return '';
}
export function reviewErr(x: ReviewSource) {
  if (!x.url) return 'Add the public review page URL, or remove this link.';
  if (!validUrl(x.url)) return 'Enter a full URL starting with https://';
  const d = REVIEW_DOMAINS[x.platform];
  if (d && !d.test(x.url)) return 'This doesn’t look like a ' + x.platform + ' address.';
  return '';
}
/** `currentAgency` is the platform relationship (agency team membership), never a typed name. */
export function experienceErr(x: ExperienceEntry, currentAgency: { id?: string | number; name: string } | null) {
  const now = new Date().toISOString().slice(0, 7);
  if (!x.agencyId && !String(x.agencyName || '').trim()) return 'Enter the agency name.';
  if (!String(x.position || '').trim()) return 'Add your position at this agency.';
  if (!/^\d{4}-\d{2}$/.test(x.start || '')) return 'Choose the start month.';
  if (x.start > now) return 'The start month can’t be in the future.';
  if (!x.current) {
    if (!/^\d{4}-\d{2}$/.test(x.end || '')) return 'Choose the end month, or tick “I currently work here”.';
    if (x.end < x.start) return 'The end month must be after the start month.';
    if (x.end > now) return 'The end month can’t be in the future.';
  }
  const cur = currentAgency?.id != null ? String(currentAgency.id) : '';
  if (x.current && x.agencyId && String(x.agencyId) !== cur) return 'You aren’t on this agency’s team on Emirate08. Untick “I currently work here”, or ask the agency to add you to its team.';
  if (x.current && cur && String(x.agencyId || '') !== cur) return 'Your current Emirate08 agency is ' + currentAgency!.name + '. A different current agency would contradict your profile.';
  return '';
}

/* ---------------- public record ---------------- */
/** The extra public fields. Spread into every broker mapper (client store, /api/app-public, server page). */
export function profileExtras(portfolio: any) {
  const p = withProfileDefaults({ ...(portfolio && typeof portfolio === 'object' ? portfolio : {}) });
  return {
    location: p.location || '',
    journey: p.journey || '',
    experienceEntries: p.experienceEntries,
    clients: p.clients,
    services: p.services,
    whyPoints: p.whyPoints.filter((w: WhyPoint) => w && String(w.title || '').trim()).slice(0, 4),
    approach: p.approach || '',
    areaMeta: p.areaMeta,
    certifications: (p.credentials || []).filter((c: any) => c && c.label),
    booking: safeUrl(p.booking),
    website: safeUrl(p.website),
    socials: p.showSocials ? p.socials.filter((s: Social) => safeUrl(s.url)) : [],
    reviewSources: p.reviewSources.filter((x: ReviewSource) => safeUrl(x.url)),
    achievements: p.achievements.filter((x: Achievement) => x.approved),
    indexable: p.indexable,
    contactMode: p.contactMode,
    defaultSort: p.defaultSort,
    history: p.history || '',
    founded: p.founded ? String(p.founded) : '',
    address: p.address || '',
    teamMeta: p.teamMeta,
    includeTeam: p.includeTeam,
  };
}

export function monthLabel(ym?: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(+m || 1) - 1] + ' ' + y;
}
export function listJoin(arr: string[]) {
  arr = (arr || []).filter(Boolean);
  if (arr.length < 2) return arr.join('');
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}
export function compactAed(n: number) {
  if (n >= 1e6) return 'AED ' + (Math.round(n / 1e4) / 100).toString() + 'M';
  if (n >= 1e3) return 'AED ' + Math.round(n / 1e3) + 'K';
  return 'AED ' + n;
}

/** Areas with their primary flag and local note, in the order the broker added them. */
export function areaRows(areas: string[], meta: AreaMeta = {}) {
  return (areas || []).map((name) => ({ name, primary: !!meta[name]?.primary, note: meta[name]?.note || '' }));
}

/* ---------------- FAQ — answers are built only from the profile record ---------------- */
export function faqItems(P: { areas: { name: string; primary: boolean; note: string }[]; languages: string[]; clients: string[]; specialties: string[]; approach: string; preferred: string; booking: string; active: any[]; agency?: boolean }) {
  const A = !!P.agency, me = A ? 'we' : 'I', Me = A ? 'We' : 'I', my = A ? 'our' : 'my', My = A ? 'Our' : 'My';
  const all = P.areas.map((a) => a.name);
  const prim = P.areas.filter((a) => a.primary).map((a) => a.name);
  const note = P.areas.find((a) => a.note);
  const areasAns = all.length
    ? Me + ' focus on ' + listJoin(prim.length ? prim : all) + (all.length > prim.length && prim.length ? ', and also cover ' + listJoin(all.filter((a) => prim.indexOf(a) < 0)) : '') + '.' + (note ? ' In ' + note.name + ': ' + note.note : '')
    : 'Get in touch with the community you are interested in and ' + me + ' will tell you whether ' + me + ' can help.';
  const intl = P.clients.join(' ').toLowerCase().indexOf('international') > -1;
  const intlAns = (intl ? 'Yes. International investors and relocating buyers are among the clients ' + me + ' work with most. ' : 'Yes, ' + me + ' can work with buyers who are not yet in Dubai. ') + (P.languages.length ? Me + ' can advise in ' + listJoin(P.languages) + ', ' : '') + 'and viewings can be arranged by video call before you travel.';
  const hasOff = P.active.some((l) => l.completion === 'offplan') || P.specialties.join(' ').toLowerCase().indexOf('off-plan') > -1;
  const hasReady = P.active.some((l) => l.completion !== 'offplan');
  const readyAns = hasOff && hasReady
    ? 'Yes. ' + My + ' current portfolio includes both ready homes and off-plan units, and ' + me + ' can explain payment plans, escrow registration and expected handover dates.'
    : hasOff ? Me + ' focus mainly on off-plan purchases, including payment plans and handover timelines.' : 'Most of ' + my + ' current properties are ready to move into. Ask about off-plan options in the same communities.';
  const pref = ({ whatsapp: 'WhatsApp', call: 'a phone call', email: 'email', form: 'the enquiry form on this page' } as Record<string, string>)[P.preferred] || 'the enquiry form on this page';
  const viewAns = 'Send a message with the property you are interested in and your available times. The quickest way is ' + pref + '.' + (P.booking ? ' You can also book a slot online.' : '');
  const compareAns = P.approach || 'Yes. Share your budget, preferred communities and timeline, and ' + me + ' will shortlist suitable properties with the key numbers side by side.';
  const startAns = 'Use Contact ' + (A ? 'Agency' : 'Broker') + ' to share what you are looking for. ' + (A ? 'Your enquiry is passed to the consultant who covers that community' : 'I usually reply the same working day') + ', and the first conversation is about your requirements — there is no obligation.';
  return [
    ['Which areas ' + (A ? 'does the agency' : 'do you') + ' specialize in?', areasAns],
    ['Can you help international buyers?', intlAns],
    ['Do you handle both ready and off-plan properties?', readyAns],
    ['How can I arrange a viewing?', viewAns],
    ['Can you help me compare suitable properties?', compareAns],
    ['How do I start working with ' + (A ? 'your agency' : 'you') + '?', startAns],
  ];
}

/* ---------------- readiness checklists (not rankings) ---------------- */
type Check = { label: string; pass: boolean; hint: string; section: string };
export type ReadinessGroup = { title: string; items: Check[]; passed: number; total: number; pct: number };
export function readiness(D: any, ctx: { active: any[]; done: any[]; verified: boolean; published: boolean; fieldStatus: Record<string, string>; agency?: boolean }) {
  const A = !!ctx.agency;
  const has = (v: any) => (Array.isArray(v) ? v.length > 0 : !!String(v == null ? '' : v).trim());
  const text = [D.headline, D.intro, D.bio, D.journey, D.approach]
    .concat((D.whyPoints || []).map((w: WhyPoint) => w.title + ' ' + (w.desc || '')), (D.experienceEntries || []).map((x: ExperienceEntry) => [x.agencyName, x.position, x.desc].join(' ')), D.specialties || [], D.services || [], D.clients || [])
    .join(' ');
  const aboutLen = text.trim().length;
  const fs = ctx.fieldStatus || {};
  const unreviewed = Object.keys(fs).filter((k) => fs[k] === 'verify' || fs[k] === 'suggestion');
  const missingFs = Object.keys(fs).filter((k) => fs[k] === 'missing');
  const areas: string[] = D.areas || [];
  const meta: AreaMeta = D.areaMeta || {};
  const sources = (D.socials || []).length + (has(D.website) ? 1 : 0);
  const outside = ctx.active.filter((l) => areas.indexOf(l.area) < 0);
  const pub = ctx.published && D.isPublic !== false;
  const phoneOk = D.contactMode !== 'form' && (has(D.whatsapp) || has(D.publicPhone));
  const c = (label: string, pass: any, hint: string, section: string): Check => ({ label, pass: !!pass, hint, section });
  const groups: Record<string, Omit<ReadinessGroup, 'passed' | 'total' | 'pct'>> = {
    seo: { title: 'SEO Readiness', items: [
      c('Title and meta description can be generated', has(D.displayName) && (A ? has(D.headline) : has(D.title)) && has(D.intro), A ? 'Add a headline and short introduction.' : 'Add a professional title and short introduction.', 'identity'),
      c('Clear heading structure', has(D.displayName) && aboutLen > 200, 'Write at least two About sections so the page has meaningful H2/H3 headings.', 'about'),
      c('Substantial unique profile content', aboutLen > 600, 'Add a fuller biography and specific details about how you work.', 'about'),
      c('Images have descriptive alt text', has(D.photo), A ? 'Upload your agency logo; alt text is generated from your name.' : 'Upload a professional photo; alt text is generated from your name.', 'identity'),
      c('Internal links to properties', ctx.active.length > 0, 'Publish at least one listing so the profile links to property pages.', 'portfolio'),
      c('Crawlable public page', D.isPublic !== false && D.indexable !== false, 'Turn on Public profile and Allow search engine indexing.', 'visibility'),
      c('Structured data facts available', has(D.displayName) && areas.length > 0 && has(D.specialties), 'Add service areas and specializations for the ProfilePage / ' + (A ? 'Organization' : 'Person') + ' markup.', 'areas'),
      c('Published and reachable', pub, 'Publish your profile.', 'visibility'),
    ] },
    ai: { title: 'AI Information Readiness', items: [
      c('Identity is clear', has(D.displayName) && has(D.headline) && (A || has(D.title)), A ? 'Make sure the company name and headline are filled in.' : 'Make sure name, title and headline are filled in.', 'identity'),
      c('Experience details', A ? has(D.history) : has(D.experience) && has(D.journey), A ? 'Add your company history.' : 'Add years of experience and your professional journey.', A ? 'about' : 'identity'),
      c('Areas of expertise named', has(D.specialties), 'Add property specializations.', 'about'),
      c('Relevant service areas with local notes', areas.length > 0 && areas.some((a) => has(meta[a]?.note)), 'Add service areas and a short local-knowledge note for at least one.', 'areas'),
      c('Verifiable external sources', sources > 0, 'Link a professional profile (e.g. LinkedIn) or business website.', 'contact'),
      c('FAQ answers are specific', areas.length > 0 && (A || has(D.languages)) && has(D.approach), A ? 'Areas and your company approach feed the FAQ answers.' : 'Areas, languages and your approach feed the FAQ answers.', 'about'),
      c('Facts are consistent', outside.length === 0, outside.length ? outside.length + ' active listing(s) are outside your service areas — add those areas or check the listings.' : '', 'areas'),
      c('No unconfirmed AI claims', unreviewed.length === 0, 'Confirm or edit fields marked Needs Your Input.', 'identity'),
    ] },
    cro: { title: 'Human CRO Readiness', items: [
      c('Clear headline (under 120 characters)', has(D.headline) && D.headline.length <= 120, 'Write one specific line about who you help and where.', 'identity'),
      c('Easy to contact', phoneOk || has(D.publicEmail), 'Add a business phone, WhatsApp or email, and show contact details.', 'contact'),
      c('Trust evidence visible', ctx.verified || (D.reviewSources || []).length > 0, 'Verify your credentials or link an external review page.', 'credentials'),
      c('Relevant properties to explore', ctx.active.length >= 3, 'Aim for at least three published listings.', 'portfolio'),
      c('Featured listings chosen', (D.featuredOrder || []).length > 0, 'Feature your best listings so they appear first.', 'portfolio'),
      c('Works well on mobile', has(D.photo) && (!has(D.headline) || D.headline.length <= 120), A ? 'A logo and a short headline keep the mobile hero clear.' : 'A photo and a short headline keep the mobile hero clear.', 'identity'),
      c('Preferred contact method set', has(D.preferred), 'Choose a preferred contact method.', 'contact'),
    ] },
    trust: { title: 'Trust & Verification', items: [
      c((A ? 'ORN' : 'BRN') + ' credential verified', ctx.verified, 'Submit your registration document in Account → Credentials.', 'credentials'),
      c('Claims confirmed', unreviewed.length === 0 && missingFs.length === 0, 'Review AI-generated fields that need verification or information.', 'identity'),
      c('Supporting references', (D.achievements || []).some((x: Achievement) => x.approved) || ctx.done.length > 0 || (D.reviewSources || []).length > 0, 'Add an approved case study, a review link, or show completed transactions.', 'reviews'),
      c('Published status', pub, 'Publish your profile.', 'visibility'),
    ] },
  };
  const out: Record<string, ReadinessGroup> = {};
  for (const [k, g] of Object.entries(groups)) {
    const n = g.items.filter((i) => i.pass).length;
    out[k] = { ...g, passed: n, total: g.items.length, pct: Math.round((n / g.items.length) * 100) };
  }
  return out;
}
