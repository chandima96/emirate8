import {
  updateAccountAction,
  deleteAccountAction,
  authenticateAction,
  createEnquiryAction,
  updateEnquiryStatusAction,
  startProfessionalCheckoutAction,
  completeProfessionalCheckoutAction,
  sendEmailCodeAction,
  confirmEmailCodeAction,
} from '@/app/actions';
/*
 * Emirate08 client data layer. Supabase Postgres, accessed through authenticated
 * Payload Server Actions and read endpoints, is the source of truth. This module keeps an in-memory
 * view for reactive client rendering; it does not persist records locally.
 */
import { read, write, writeImmediate, clearAll, hydrate, cache, setAuthenticated, flushWrites, getVersion } from './storage';
import { uid, slugify, clone } from './utils';
import { PLANS, STATUS, LEGACY_STATUS, USD_PEG } from '@/config/reference';
import { planIdForAudience, demoPlanPrice } from '@/config/plans';
import { IMG, PIMG } from '@/config/images';
import { mediaDisplayURL } from './mediaURL';
import { profileExtras } from './brokerProfile';
import {
  setPublicData,
  getPublicBrokers,
  getPublicListings,
  getPublicMemberBrokers,
  getPublicAgencies,
  getPublicPlans,
  refreshPublicData,
  type PublicPlan,
  type PublicListing,
} from './publicStore';

/**
 * applyPublicData — push fresh data from /api/app-public into the reactive
 * Zustand publicStore (replaces module-level mutable arrays).
 */
function applyPublicData(data) {
  setPublicData({
    brokers: data?.brokers,
    listings: data?.listings,
    memberBrokers: data?.memberBrokers,
    agencies: data?.agencies,
    plans: data?.plans,
  });
  write('session', { userId: activeUser?.id || null });
}

export function normalize(l) {
  if (!l) return l;
  if (LEGACY_STATUS[l.status]) l.status = LEGACY_STATUS[l.status];
  if (!l.photos)
    l.photos = (l.images || []).map(function (s) {
      return { src: s, caption: '' };
    });
  var srcs = l.photos.map(function (p) {
    return p.src;
  });
  if (!l.featured || srcs.indexOf(l.featured) < 0) l.featured = srcs[0] || '';
  l.images = l.featured
    ? [l.featured].concat(
        srcs.filter(function (s) {
          return s !== l.featured;
        }),
      )
    : srcs;
  l.display = l.display || { visible: true, portfolioFeatured: false, contact: 'any' };
  l.media = l.media || {};
  l.media.floorplans = l.media.floorplans || [];
  l.highlights = l.highlights || [];
  l.amenities = l.amenities || [];
  l.completion = l.completion || 'ready';
  if (l.completion === 'offplan') {
    l.purpose = 'sale';
    l.offplan = l.offplan || { plan: [] };
    l.offplan.plan = l.offplan.plan || [];
    l.handover = l.offplan.handover || l.handover || '';
  }
  l.slug = l.slug || l.id;
  l.available = l.status === 'published' && l.display.visible !== false;
  l.listed = Math.max(0, Math.round((Date.now() - new Date(l.createdAt || Date.now()).getTime()) / 864e5));
  l.permitStatus =
    l.permit && l.permit.number ? (l.sample || /^SAMPLE/.test(l.permit.number) ? 'verified' : 'pending') : 'missing';
  return l;
}
export function photoOf(l) {
  return mediaDisplayURL((l && (l.featured || (l.images && l.images[0]))) || '');
}

/* ---------- Password hashing (demo) ---------- */
function hex(buf) {
  return Array.prototype.map
    .call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    })
    .join('');
}
function fallbackHash(str) {
  // non-cryptographic fallback for browsers without SubtleCrypto
  var h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (var r = 0; r < 2000; r++)
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i) + r;
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
  return 'f' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}
export function hashPassword(password, salt) {
  var input = salt + ':' + password;
  try {
    if (typeof window !== 'undefined' && window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(input))
        .then(hex)
        .catch(function () {
          return fallbackHash(input);
        });
    }
  } catch (e) {}
  return Promise.resolve(fallbackHash(input));
}
function newSalt() {
  try {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return hex(a);
  } catch (e) {
    return Math.random().toString(36).slice(2);
  }
}

/* ---------- Seeding ---------- */
export function defaultPortfolio(user, o = undefined) {
  o = o || {};
  return {
    slug: o.slug || slugify(user.name),
    displayName: o.displayName || user.name,
    title: o.title || (user.type === 'agency' ? 'Real Estate Agency' : 'Licensed Real Estate Broker'),
    headline: o.headline || '',
    intro: o.intro || '',
    bio: o.bio || '',
    experience: o.experience || '',
    languages: o.languages || [],
    areas: o.areas || [],
    specialties: o.specialties || [],
    credentials: o.credentials || [],
    photo: o.photo || '',
    cover: o.cover || IMG + 'cta-dubai-dusk.webp',
    coverPos: o.coverPos == null ? 50 : o.coverPos,
    publicEmail: o.publicEmail || '',
    publicPhone: o.publicPhone || '',
    whatsapp: o.whatsapp || '',
    preferred: o.preferred || 'whatsapp',
    agency: o.agency || null,
    isPublic: o.isPublic !== false,
    searchable: o.searchable !== false,
    showClosed: o.showClosed !== false,
    defaultSort: o.defaultSort || 'featured',
    featuredOrder: o.featuredOrder || [],
    updatedAt: new Date().toISOString(),
  };
}

let activeUser = null;
let seeding = null;
let accountSaveQueue: Promise<unknown> = Promise.resolve();
let lastPublicRefreshAt = 0;

export function setCurrentUser(user) {
  activeUser = user || null;
  if (!activeUser) setAuthenticated(false);
}

async function activateUser(user) {
  activeUser = user || null;
  if (!activeUser) {
    setAuthenticated(false);
    return;
  }
  try {
    const [stateResponse, enquiriesResponse] = await Promise.all([
      fetch('/api/app-state', { credentials: 'same-origin', cache: 'no-store' }),
      fetch('/api/app-enquiries', { credentials: 'same-origin', cache: 'no-store' }),
    ]);
    if (!stateResponse.ok) throw new Error(`Could not load account data (${stateResponse.status}).`);
    const result = await stateResponse.json();
    const enquiriesResult = enquiriesResponse.ok ? await enquiriesResponse.json() : { enquiries: [] };
    hydrate({ ...(result.state || {}), enquiries: enquiriesResult.enquiries || [] });
    publishPendingListings();
  } catch (error) {
    activeUser = null;
    setAuthenticated(false);
    throw error;
  }
}

/**
 * Listings have no separate admin review: they go live on publish. A member whose credentials are not yet
 * verified keeps published-intent listings as "pending"; once the credential review approves them, those
 * listings go live here (within the plan's published-listing limit).
 */
function publishPendingListings() {
  if (!activeUser || activeUser.credentialStatus !== 'verified') return;
  const d = data();
  if (!d) return;
  const limit = plan().listings;
  let live = counts().published;
  d.listings
    .filter((l) => l.status === 'pending')
    .forEach((l) => {
      if (limit && live >= limit) return;
      l.status = 'published';
      l.display = { ...(l.display || {}), visible: true };
      saveListing(l);
      live++;
    });
}

let sessionRequest: Promise<any> | null = null;
/**
 * The signed-in member alone, without the public catalogue or workspace data. It answers quickly, so the
 * header can show the account before the rest of the store has loaded. Shared with ensureSeed.
 */
export function loadSessionUser(): Promise<any> {
  if (!sessionRequest) {
    sessionRequest = fetch('/api/app-session', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load your account session.');
        return response.json();
      })
      .then((result) => result?.user || null)
      .catch((error) => {
        sessionRequest = null;
        throw error;
      });
  }
  return sessionRequest;
}

/** The member's profile photo (an agency's logo), or '' when none is set. */
export function userPhoto(u): string {
  if (!u) return '';
  const src = u.portfolio?.photo || u.photo || u.logo || '';
  return typeof src === 'string' ? mediaDisplayURL(src) : '';
}

export function ensureSeed() {
  if (seeding) return seeding;
  seeding = (async () => {
    setAuthenticated(false);
    const [publicData, sessionUser] = await Promise.all([refreshPublicData(), loadSessionUser()]);
    lastPublicRefreshAt = Date.now();
    applyPublicData(publicData);
    if (sessionUser) await activateUser(sessionUser);
    else activeUser = null;
  })().catch((error) => {
    seeding = null;
    sessionRequest = null;
    throw error;
  });
  return seeding;
}

let refreshing: Promise<void> | null = null;
export function refreshData() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    await ensureSeed();
    await flushWrites();
    const version = getVersion();
    const refreshPublic = Date.now() - lastPublicRefreshAt >= 5 * 60_000;
    const [publicData, sessionResponse] = await Promise.all([
      refreshPublic ? refreshPublicData() : Promise.resolve(null),
      fetch('/api/app-session', { credentials: 'same-origin', cache: 'no-store' }),
    ]);
    if (publicData) lastPublicRefreshAt = Date.now();
    if (!sessionResponse.ok) throw new Error('Could not refresh account data.');
    const sessionData = await sessionResponse.json();
    let workspace = null;
    if (sessionData.user) {
      const [stateResponse, enquiriesResponse] = await Promise.all([
        fetch('/api/app-state', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/app-enquiries', { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      if (!stateResponse.ok || !enquiriesResponse.ok) throw new Error('Could not refresh workspace data.');
      const state = await stateResponse.json();
      const enquiries = await enquiriesResponse.json();
      workspace = { ...(state.state || {}), enquiries: enquiries.enquiries || [] };
    }
    // A response started before an edit or sign-out must not replace newer state.
    if (getVersion() !== version) return;
    activeUser = sessionData.user || null;
    if (workspace) hydrate(workspace);
    else setAuthenticated(false);
    if (publicData) applyPublicData(publicData);
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/* ---------- Users & session ---------- */
export function users() {
  return activeUser ? [activeUser] : [];
}
export function userById(id) {
  return activeUser && activeUser.id === id ? activeUser : null;
}
export function saveUser(user) {
  activeUser = user;
  const profile = clone({
    legalName: user.legalName,
    credentials: user.credentials,
    privacy: user.privacy,
    prefs: user.prefs,
    notifications: user.notifications,
    portfolio: user.portfolio,
    portfolioDraft: user.portfolioDraft,
    // Developer company profile (members.profile.developer); only sent when the account has one.
    ...(user.developer ? { developer: user.developer } : {}),
    trial: user.trial,
    trialEnds: user.trialEnds,
  });
  const patch = {
    name: user.name,
    mobile: user.mobile,
    plan: user.plan,
    credentialStatus: user.credentialStatus,
    profile,
  };
  accountSaveQueue = accountSaveQueue
    .catch(() => undefined)
    .then(() => updateAccountAction(patch))
    .then((result) => {
      if (!result.ok) throw new Error(`Account update failed (${result.status}).`);
    })
    .catch((error) => console.error('[account] Could not save to Supabase:', error));
  write('session', { userId: user.id });
  return user;
}
export async function verifyDemoCredentials() {
  if (!activeUser) throw new Error('Sign in to verify your credentials.');
  const result = await updateAccountAction({ credentialStatus: 'verified' });
  if (!result.ok) throw new Error(result.error || 'Could not verify credentials. Please try again.');
  activeUser = result.user;
  write('session', { userId: activeUser.id });
  return activeUser;
}
export async function deleteUser(id, password) {
  if (!activeUser || activeUser.id !== id) return false;
  const result = await deleteAccountAction(password);
  if (!result.ok) {
    throw new Error(result?.error || `Account deletion failed (${result.status}).`);
  }
  signOut();
  return true;
}
export function findByLogin(login) {
  var v = String(login || '')
    .trim()
    .toLowerCase();
  var digits = v.replace(/\D/g, '');
  return (
    users().find(
      (u) =>
        u.email?.toLowerCase() === v ||
        (digits.length >= 7 && (u.mobile || '').replace(/\D/g, '').slice(-9) === digits.slice(-9)),
    ) || null
  );
}
export function session(): { userId: string | number; at?: string; remember?: boolean } | null {
  return activeUser ? { userId: activeUser.id } : null;
}
export function currentUser() {
  return activeUser;
}
export function isBroker(u) {
  u = u === undefined ? currentUser() : u;
  return !!u && (u.type === 'broker' || u.type === 'agency');
}
export function role(u) {
  u = u === undefined ? currentUser() : u;
  if (!u) return 'guest';
  if (u.type === 'buyer') return 'buyer';
  if (u.type === 'developer' || u.type === 'owner') return 'developer';
  if (u.type === 'agency') return 'agency';
  return 'broker';
}
export function signIn(userId, remember) {
  const user = userById(userId);
  if (user) activeUser = user;
}
export function signOut() {
  authenticateAction({ action: 'logout' }).catch(() => undefined);
  activeUser = null;
  setAuthenticated(false);
}

export function login(loginId, password, remember) {
  return authenticateAction({ action: 'login', login: loginId, password, remember })
    .then(async (result) => {
      if (!result.ok) {
        const message = result.error || 'Sign in failed. Please check your details and try again.';
        return { ok: false, field: /password/i.test(message) ? 'password' : 'login', message };
      }
      await activateUser(result.user);
      write('session', { userId: result.user.id });
      return { ok: true, user: result.user };
    })
    .catch((error) => ({
      ok: false,
      user: undefined,
      field: 'login',
      message: error.message || 'Could not reach the server.',
    }));
}

export function checkRegistrationEmail(email) {
  return authenticateAction({ action: 'check-registration-email', email })
    .then((result) => ({ ok: result.ok, field: result.field, message: result.error }))
    .catch((error) => ({
      ok: false,
      field: 'form',
      message: error.message || 'Could not check this email address. Please try again.',
    }));
}

/** Everyone registers as a buyer; professionals upgrade afterwards through Stripe Checkout (`startProfessionalCheckout`). */
export function register(payload) {
  const profile = {
    legalName: payload.name,
    credentials: {},
    trial: false,
    notifications: { enquiries: true, network: true, selection: true, billing: true, product: false },
    privacy: {
      showPhone: true,
      showEmail: true,
      showWhatsapp: true,
      showBrn: true,
      showLanguages: true,
      showExperience: true,
      showTransactions: true,
    },
    prefs: { language: 'English', currency: 'AED', contact: 'email' },
  };

  return authenticateAction({
    action: 'register',
    name: payload.name,
    email: payload.email,
    password: payload.password,
    accountType: 'buyer',
    plan: 'starter',
    profile,
  })
    .then(async (result) => {
      if (!result.ok)
        return {
          ok: false,
          field: result.field || (result.status === 409 ? 'email' : 'form'),
          message: result.error,
        };
      await activateUser(result.user);
      return { ok: true, user: currentUser() };
    })
    .catch((error) => ({
      ok: false,
      user: undefined,
      field: 'form',
      message: error.message || 'Could not reach the server.',
    }));
}

/** Sets up the professional portfolio once an account has been upgraded. */
async function afterUpgrade(serverUser, credentials) {
  await activateUser(serverUser);
  const user = currentUser();
  if (user && !user.portfolio) {
    user.portfolio = defaultPortfolio(user, {
      slug: uniqueSlug(slugify(user.name)),
      publicEmail: user.email,
      publicPhone: user.mobile,
      whatsapp: user.mobile,
      agency:
        user.type === 'agency' ? { name: credentials?.agencyName || '', website: '', orn: credentials?.orn || '' } : null,
    });
    saveUser(user);
  }
  return user;
}

/**
 * Saves the professional details and starts payment. Resolves with `{ url }` to send the browser to
 * Stripe Checkout, or `{ user }` when the plan needs no payment and the account was upgraded directly.
 */
export async function startProfessionalCheckout({ type, plan, credentials }) {
  try {
    const result = await startProfessionalCheckoutAction({ accountType: type, plan, credentials });
    if (!result.ok) return { ok: false, field: result.field || 'form', message: result.error };
    if (result.clientSecret) return { ok: true, clientSecret: result.clientSecret, sessionId: result.sessionId };
    if (result.url) return { ok: true, url: result.url };
    return { ok: true, user: await afterUpgrade(result.user, credentials) };
  } catch (error) {
    return { ok: false, field: 'form', message: error?.message || 'Could not reach the server.' };
  }
}

/** After Stripe Checkout: confirms the payment and applies the upgrade. */
export async function completeProfessionalCheckout(sessionId) {
  try {
    const result = await completeProfessionalCheckoutAction(sessionId || '');
    if (result.pending) return { ok: false, pending: true, message: result.error };
    if (!result.ok) return { ok: false, message: result.error || 'Could not confirm your payment.' };
    return { ok: true, user: await afterUpgrade(result.user, result.user?.credentials) };
  } catch (error) {
    return { ok: false, message: error?.message || 'Could not reach the server.' };
  }
}

/** True once the signed-in member has confirmed their email (Google sign-ups are confirmed by Google). */
export function emailVerified(u = currentUser()) {
  return !!u && (u.emailVerified === true || u.authProvider === 'google');
}

export async function sendEmailCode() {
  try {
    const result = await sendEmailCodeAction();
    return result.ok
      ? { ok: true, email: result.email, alreadyVerified: !!result.alreadyVerified }
      : { ok: false, message: result.error || 'Could not send a confirmation code.' };
  } catch (error) {
    return { ok: false, message: error?.message || 'Could not reach the server.' };
  }
}

export async function confirmEmailCode(code) {
  try {
    const result = await confirmEmailCodeAction(code);
    if (!result.ok) return { ok: false, message: result.error || 'Could not confirm your email.' };
    if (activeUser) activeUser = { ...activeUser, emailVerified: true };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error?.message || 'Could not reach the server.' };
  }
}
export function uniqueSlug(base, selfId = undefined) {
  var taken = {};
  brokers({ all: true }).forEach(function (broker) {
    if (selfId != null && String(broker.userId ?? broker.id) === String(selfId)) return;
    taken[broker.slug] = 1;
  });
  users().forEach(function (u) {
    if (u.portfolio && (selfId == null || String(u.id) !== String(selfId))) taken[u.portfolio.slug] = 1;
  });
  var s = base,
    i = 2;
  while (taken[s]) s = base + '-' + i++;
  return s;
}

export async function resetDemo() {
  clearAll();
  if (activeUser) {
    await fetch('/api/app-state', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: '*' }),
    });
  }
  seeding = null;
}

/* ---------- Per-user workspace data ---------- */
export function data(user = undefined) {
  user = user || currentUser();
  if (!user) return null;
  var d = read('data:' + user.id, null);
  if (!d) {
    d = { listings: [], selected: [], activity: [] };
    write('data:' + user.id, d);
  }
  const savedSelection = read('selected:' + user.id, null);
  if (Array.isArray(savedSelection)) d.selected = savedSelection;
  d.listings.forEach(normalize);
  return d;
}
function strip(d) {
  var copy = clone(d);
  (copy.listings || []).forEach(function (x) {
    delete x.broker;
    delete x.images;
    delete x.available;
    delete x.listed;
    delete x.own;
    delete x.permitStatus;
  });
  return copy;
}
export function saveData(d, user = undefined, immediate = false) {
  user = user || currentUser();
  if (user) return (immediate ? writeImmediate : write)('data:' + user.id, strip(d));
  return false;
}
export function log(text, icon) {
  var d = data();
  if (!d) return;
  d.activity.unshift({ at: new Date().toISOString(), icon: icon || 'dot', text: text });
  d.activity = d.activity.slice(0, 40);
  saveData(d, undefined, true);
}

export function plan(user = undefined) {
  user = user || currentUser();
  const available = plans();
  const audience = user?.type === 'owner' ? 'developer' : user?.type || 'broker';
  const resolvedId = planIdForAudience(user?.plan, audience as 'broker' | 'agency' | 'developer');
  const current = available[resolvedId] || PLANS['broker-bronze'];
  return user?.membership?.plan === resolvedId ? { ...current, price: user.membership.price } : current;
}

export function plans(): Record<string, PublicPlan> {
  const merged: Record<string, PublicPlan> = { ...PLANS, ...getPublicPlans() };
  for (const id of Object.keys(merged)) {
    const demo = merged[id].price == null ? demoPlanPrice(id) : null;
    if (demo) merged[id] = { ...merged[id], price: demo };
  }
  return merged;
}

/* ---------- Public brokers (sample + registered brokers) ---------- */
export function brokerFromUser(u) {
  var p = u.portfolio || defaultPortfolio(u),
    pv = u.privacy || {};
  var verified = u.credentialStatus === 'verified';
  var creds = (p.credentials || []).map(function (c) {
    return { label: c.label, value: c.value, verified: !!c.verified && verified };
  });
  var brn = u.credentials && u.credentials.brn;
  var name = p.displayName || u.name;
  return {
    id: u.id,
    userId: u.id,
    type: (u.type === 'agency' ? 'agency' : 'broker') as 'agency' | 'broker',
    slug: p.slug,
    name: name,
    title: p.title,
    location: p.location || '',
    headline: p.headline,
    intro: p.intro,
    bio: p.bio,
    photo: p.photo,
    cover: p.cover,
    coverPos: p.coverPos,
    initials: name
      .split(/\s+/)
      .map(function (x) {
        return x[0];
      })
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    tone: 1,
    areas: p.areas || [],
    languages: pv.showLanguages === false ? [] : p.languages || [],
    specialties: p.specialties || [],
    experience: pv.showExperience === false ? '' : p.experience,
    brn: pv.showBrn === false || !brn ? '' : 'BRN ' + brn,
    brnVerified: verified && !!brn && pv.showBrn !== false,
    credentials:
      pv.showBrn === false
        ? creds.filter(function (c) {
            return !/BRN/.test(c.label);
          })
        : creds,
    phone: pv.showPhone === false ? '' : p.publicPhone,
    whatsapp: pv.showWhatsapp === false ? '' : p.whatsapp,
    email: pv.showEmail === false ? '' : p.publicEmail,
    preferred: p.preferred,
    agency: p.agency && p.agency.name ? p.agency : null,
    independent: !(p.agency && p.agency.name),
    agencyName: p.agency && p.agency.name ? p.agency.name : '',
    agencyId: p.agency && p.agency.name ? slugify(p.agency.name) : '',
    showClosed: p.showClosed,
    defaultSort: p.defaultSort,
    featuredOrder: p.featuredOrder || [],
    showTransactions: pv.showTransactions !== false,
    isPublic: p.isPublic !== false,
    searchable: p.searchable !== false,
    since: new Date(u.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    sample: false,
    demo: !!u.demo,
    // Broker profile release: journey, why-points, socials, review links, visibility options…
    ...profileExtras(p),
    // A certification shows as verified only after Emirate08 has reviewed the account.
    certifications: profileExtras(p).certifications.map(function (c) {
      return { ...c, verified: !!c.verified && verified };
    }),
    agencyRole: (u.agency && u.agency.agencyRole) || '',
    // Current agency = team membership on Emirate08 (never a typed name).
    currentAgency:
      u.agency && u.agency.agencyRole === 'agency_broker' && u.agency.name
        ? { id: u.agency.agencyId, name: u.agency.name, slug: u.agency.slug || '' }
        : null,
    brnNumber: pv.showBrn === false || !brn ? '' : String(brn),
    // agency registration (shown on the agency profile)
    orn: (u.credentials && u.credentials.orn) || '',
    ornVerified: verified && !!(u.credentials && u.credentials.orn),
    tradeLicence: (u.credentials && u.credentials.tradeLicence) || '',
    tradeLicenceVerified: verified && !!(u.credentials && u.credentials.tradeLicence),
    address: p.address || '',
  };
}
export function brokerPreview(u) {
  var c = clone(u);
  if (c.portfolioDraft) c.portfolio = c.portfolioDraft;
  return brokerFromUser(c);
}
function brokerUsers() {
  return users().filter(function (u) {
    return u.type === 'broker' || u.type === 'agency';
  });
}
export function brokers(opts = undefined) {
  opts = opts || {};
  const ownBroker = currentUser() && isBroker(currentUser()) ? brokerFromUser(currentUser()) : null;
  const list = [...getPublicBrokers(), ...getPublicMemberBrokers()];
  if (ownBroker && !list.some((record) => record.id === ownBroker.id)) list.push(ownBroker);
  return list.filter((record) => record.isPublic !== false && (opts.all || record.searchable !== false));
}
export function broker(idOrSlug) {
  if (!idOrSlug) return null;
  const record = brokers({ all: true }).find((item) => item.id === idOrSlug || item.slug === idOrSlug);
  if (record) return record;
  var u = brokerUsers().filter(function (x) {
    return x.id === idOrSlug || (x.portfolio && x.portfolio.slug === idOrSlug);
  })[0];
  return u ? brokerFromUser(u) : null;
}
export function brokerUrl(b) {
  return '/brokers/' + encodeURIComponent(b.slug || b.id);
}

/* Public agency directory records come from Payload's agencies collection. */
export function agencies() {
  return getPublicAgencies();
}
export function agency(id) {
  return (
    agencies().filter(function (a) {
      return a.id === id;
    })[0] || null
  );
}

/* ---------- Public listings ---------- */
function userListings() {
  var out = [];
  brokerUsers().forEach(function (u) {
    var d = read('data:' + u.id, null);
    if (!d) return;
    var b = brokerFromUser(u);
    d.listings.forEach(function (l) {
      normalize(l);
      l.brokerId = u.id;
      l.broker = b;
      l.own = true;
      out.push(l);
    });
  });
  return out;
}
export function allRecords() {
  return getPublicListings().concat(userListings().filter((listing) => listing.status !== 'published'));
}
export function isPublic(l) {
  return l.status === 'published' && l.display.visible !== false && (!l.broker || l.broker.isPublic !== false);
}
export function isHistory(l) {
  return (l.status === 'sold' || l.status === 'rented') && l.display.visible !== false;
}
export function publicListings() {
  return allRecords().filter(isPublic);
}
export function findListing(idOrSlug) {
  return (
    allRecords().filter(function (l) {
      return l.id === idOrSlug || l.slug === idOrSlug;
    })[0] || null
  );
}
export function listingsFor(brokerId) {
  return allRecords().filter(function (l) {
    return l.brokerId === brokerId;
  });
}
export function listingUrl(l) {
  return '/property/' + encodeURIComponent(l.slug || l.id);
}
export function brokerStats(b) {
  var all = listingsFor(b.id),
    pub = all.filter(isPublic);
  var sold = all.filter(function (l) {
      return l.status === 'sold';
    }),
    rented = all.filter(function (l) {
      return l.status === 'rented';
    });
  return {
    active: pub.length,
    sale: pub.filter(function (l) {
      return l.purpose === 'sale';
    }).length,
    rent: pub.filter(function (l) {
      return l.purpose === 'rent';
    }).length,
    offplan: pub.filter(function (l) {
      return l.completion === 'offplan';
    }).length,
    sold: sold.length,
    rented: rented.length,
    soldValue: sold.reduce(function (s, l) {
      return s + (+l.price || 0);
    }, 0),
    rentedValue: rented.reduce(function (s, l) {
      return s + (+l.price || 0);
    }, 0),
  };
}

/* Broker-network view (other brokers’ inventory, used by the workspace) */
export function network(): PublicListing[];
export function network(id: string): PublicListing | null;
export function network(id = undefined) {
  const NETWORK = getPublicListings();
  if (id)
    return (
      NETWORK.filter(function (n) {
        return n.id === id;
      })[0] || (data()?.selected || []).find(function (item) { return item.id === id && item.listing; })?.listing || null
    );
  return NETWORK.slice();
}
export function counts(user = undefined) {
  var d = data(user) || { listings: [], selected: [] };
  var by = function (s) {
    return d.listings.filter(function (l) {
      return l.status === s;
    }).length;
  };
  const NETWORK = getPublicListings();
  return {
    active: by('published'),
    published: by('published'),
    draft: by('draft'),
    pending: by('pending'),
    unpublished: by('unpublished'),
    archived: by('archived'),
    paused: by('unpublished'),
    closed: by('sold') + by('rented'),
    listings: d.listings.length,
    network: NETWORK.filter(function (n) {
      return n.available;
    }).length,
    selected: d.selected.length,
    enquiries: inbox(user).filter(function (q) {
      return q.status !== 'replied';
    }).length,
  };
}

/* Own listings */
export function listing(id) {
  var d = data();
  return d
    ? d.listings.filter(function (l) {
        return l.id === id;
      })[0] || null
    : null;
}
export function saveListing(l) {
  var d = data();
  if (!d) return null;
  l.updatedAt = new Date().toISOString();
  var idx = -1;
  d.listings.forEach(function (x, i) {
    if (x.id === l.id) idx = i;
  });
  if (idx === -1) {
    l.id = l.id || uid('l');
    l.createdAt = l.updatedAt;
    l.ref = l.ref || 'E08-' + String(Date.now()).slice(-6);
    d.listings.unshift(l);
  } else d.listings[idx] = l;
  /* Public URL slug follows the title until the listing is first published, then stays fixed */
  if (!l.slugLocked && l.title) {
    var base = slugify(l.title),
      taken = {};
    allRecords().forEach(function (x) {
      if (x.id !== l.id) {
        taken[x.slug] = 1;
        taken[x.id] = 1;
      }
    });
    var sl = base,
      i = 2;
    while (taken[sl]) sl = base + '-' + i++;
    l.slug = sl;
  }
  if (l.status === 'published') l.slugLocked = true;
  if (!saveData(d)) return { error: 'storage' };
  normalize(l);
  return l;
}
export function deleteListing(id) {
  var d = data();
  d.listings = d.listings.filter(function (l) {
    return l.id !== id;
  });
  saveData(d);
}

/* Listing completeness — what must be true before publishing */
export function readiness(l, user) {
  user = user || currentUser();
  var res = l.category === 'residential',
    off = l.completion === 'offplan',
    o = l.offplan || {};
  var planTotal = (o.plan || []).reduce(function (s, m) {
    return s + (+m.pct || 0);
  }, 0);
  var checks = [
    {
      key: 'classify',
      label: 'Development status, purpose and property type',
      ok: !!(l.completion && l.purpose && l.type),
    },
    {
      key: 'location',
      label: 'Community' + (off ? ' and project name' : ''),
      ok: !!(l.emirate && l.area && (off ? o.project : true)),
    },
    {
      key: 'details',
      label: 'Title, description and size' + (res ? ', bedrooms and bathrooms' : ''),
      ok: !!(
        l.title &&
        l.title.length >= 8 &&
        l.description &&
        l.description.length >= 40 &&
        l.size &&
        (!res || (l.beds !== '' && l.beds != null && l.baths))
      ),
    },
    {
      key: 'pricing',
      label: off
        ? 'Price, developer and handover date'
        : l.purpose === 'rent'
          ? 'Annual rent and cheques'
          : 'Asking price',
      ok: !!(l.price && (off ? o.developer && o.handover : l.purpose !== 'rent' || l.cheques)),
    },
  ];
  if (off)
    checks.push({
      key: 'plan',
      label: 'Payment plan totals 100%',
      ok: Math.round(planTotal) === 100 && (o.plan || []).length > 0,
    });
  checks.push({
    key: 'media',
    label: 'At least 3 photos and a featured photo',
    ok: (l.photos || []).length >= 3 && !!l.featured,
  });
  checks.push({
    key: 'permit',
    label: 'Advertising permit number and expiry',
    ok: !!(l.permit && l.permit.number && l.permit.expiry),
  });
  checks.push({
    key: 'verified',
    label: 'Professional credentials verified',
    ok: !!(user && user.credentialStatus === 'verified'),
  });
  var core = checks.filter(function (c) {
    return c.key !== 'verified';
  });
  return {
    checks: checks,
    complete: core.every(function (c) {
      return c.ok;
    }),
    publishable: checks.every(function (c) {
      return c.ok;
    }),
    planTotal: planTotal,
  };
}

/* Formatting helpers */
export function fmtNumber(n) {
  return Number(n || 0).toLocaleString('en-AE');
}
export function fmtAED(n) {
  return 'AED ' + fmtNumber(Math.round(n));
}
export function fmtCompact(n) {
  n = +n || 0;
  return n >= 1e6
    ? 'AED ' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
    : n >= 1e3
      ? 'AED ' + Math.round(n / 1e3) + 'K'
      : fmtAED(n);
}
function currency() {
  var u = currentUser();
  return (u && u.prefs && u.prefs.currency) || 'AED';
}
function above(max, min) {
  return Number(max) > Number(min) ? Number(max) : 0;
}
export function fmtPrice(item) {
  if (!item || !item.price) return 'Price on request';
  const max = above(item.priceMax, item.price);
  return 'AED ' + fmtNumber(item.price) + (max ? ' – ' + fmtNumber(max) : '') + (item.purpose === 'rent' ? ' /year' : '');
}
/** "1,200 sqft" or "1,200 – 2,400 sqft" when the listing covers a range of sizes. */
export function fmtSize(item, key = 'size') {
  if (!item || !item[key]) return '';
  const max = above(item[key + 'Max'], item[key]);
  return fmtNumber(item[key]) + (max ? ' – ' + fmtNumber(max) : '') + ' sqft';
}
export function fmtAlt(item) {
  return currency() === 'USD' && item && item.price
    ? '≈ USD ' + fmtNumber(Math.round(item.price / USD_PEG)) + (item.purpose === 'rent' ? ' /year' : '')
    : '';
}
export function fmtSpecs(item) {
  var p = [];
  if (item.type) p.push(item.type);
  const bedsMax = above(item.bedsMax, item.beds);
  if (item.beds === 0 && bedsMax) p.push('Studio – ' + bedsMax + ' bed');
  else if (item.beds === 0 && /Apartment/.test(item.type || '')) p.push('Studio');
  else if (item.beds) p.push(item.beds + (bedsMax ? '–' + bedsMax : '') + ' bed');
  const bathsMax = above(item.bathsMax, item.baths);
  if (item.baths) p.push(item.baths + (bathsMax ? '–' + bathsMax : '') + ' bath');
  if (item.size) p.push(fmtSize(item));
  return p;
}
export function relTime(iso) {
  var s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  var d = Math.floor(s / 86400);
  return d === 1 ? 'Yesterday' : d + ' days ago';
}
export function fmtDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------- Buyer-side public data (saved, recent, enquiries) ---------- */
export function isSaved(id) {
  return read('saved', []).indexOf(id) > -1;
}
export function toggleSaved(id) {
  if (!activeUser) return false;
  var list = read('saved', []),
    i = list.indexOf(id);
  if (i > -1) list.splice(i, 1);
  else list.unshift(id);
  write('saved', list);
  return i < 0;
}
export function pushRecent(id) {
  if (!activeUser) return;
  var list = read('recent', []).filter(function (x) {
    return x !== id;
  });
  list.unshift(id);
  write('recent', list.slice(0, 12));
}
export async function addEnquiry(e) {
  const result = await createEnquiryAction(e);
  if (!result.ok) throw new Error(result.error || 'Could not send the enquiry.');
  const list = [result.enquiry, ...read('enquiries', [])].slice(0, 200);
  cache('enquiries', list);
  return result.enquiry;
}
export function enquiries() {
  return read('enquiries', []);
}
export function inbox(user = undefined) {
  user = user || currentUser();
  if (!user) return [];
  // Own enquiries, plus (for agency admins/managers) enquiries sent to the agency's brokers.
  return read('enquiries', []).filter(function (q) {
    return q.scope === 'agency' || String(q.brokerId) === String(user.id);
  });
}
export function setEnquiryStatus(id, status) {
  const list = read('enquiries', []);
  list.forEach(function (q) {
    if (q.id === id) q.status = status;
  });
  cache('enquiries', list);
  updateEnquiryStatusAction(id, status)
    .then((result) => {
      if (!result.ok) throw new Error(`Could not update enquiry (${result.status}).`);
    })
    .catch((error) => console.error('[enquiries] Could not save to Supabase:', error));
}
