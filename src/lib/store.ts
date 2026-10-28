import {
  updateAccountAction,
  deleteAccountAction,
  authenticateAction,
  createEnquiryAction,
  updateEnquiryStatusAction,
} from '@/app/actions';
/*
 * Emirate08 client data layer. Supabase Postgres, accessed through authenticated
 * Payload Server Actions and read endpoints, is the source of truth. This module keeps an in-memory
 * view for reactive client rendering; it does not persist records locally.
 */
import { read, write, clearAll, hydrate, cache, setAuthenticated, flushWrites, getVersion } from './storage';
import { uid, daysFromNow, slugify, clone } from './utils';
import { PLANS, STATUS, LEGACY_STATUS, USD_PEG } from '@/config/reference';
import { planIdForAudience } from '@/config/plans';
import { IMG, PIMG } from '@/config/images';
import { mediaDisplayURL } from './mediaURL';
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
  } catch (error) {
    activeUser = null;
    setAuthenticated(false);
    throw error;
  }
}

export function ensureSeed() {
  if (seeding) return seeding;
  seeding = (async () => {
    setAuthenticated(false);
    const [publicData, sessionResponse] = await Promise.all([
      refreshPublicData(),
      fetch('/api/app-session', { credentials: 'same-origin', cache: 'no-store' }),
    ]);
    lastPublicRefreshAt = Date.now();
    if (!sessionResponse.ok) throw new Error('Could not load your account session.');
    applyPublicData(publicData);
    const result = await sessionResponse.json();
    if (result.user) await activateUser(result.user);
    else activeUser = null;
  })().catch((error) => {
    seeding = null;
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
  })().finally(() => { refreshing = null; });
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

export function register(payload) {
  const type = payload.type || 'buyer';
  const profile = {
    legalName: payload.name,
    credentials: payload.credentials || {},
    trial: type !== 'buyer',
    trialEnds: daysFromNow(14),
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
    ...(type === 'developer'
      ? {
          developer: {
            displayName: payload.credentials?.developerName || payload.name,
            logo: payload.credentials?.developerLogo?.url || '',
            public: true,
          },
        }
      : {}),
  };

  return authenticateAction({
    action: 'register',
    name: payload.name,
    email: payload.email,
    password: payload.password,
    mobile: payload.mobile || '',
    accountType: type,
    plan: payload.plan || 'starter',
    profile,
  })
    .then(async (result) => {
      if (!result.ok) return { ok: false, field: result.status === 409 ? 'email' : 'form', message: result.error };
      await activateUser(result.user);
      const user = currentUser();
      if (user && user.type !== 'buyer') {
        user.portfolio = defaultPortfolio(user, {
          slug: uniqueSlug(slugify(user.name)),
          publicEmail: user.email,
          publicPhone: user.mobile,
          whatsapp: user.mobile,
          agency:
            user.type === 'agency' && payload.credentials
              ? { name: payload.credentials.agencyName || '', website: '', orn: payload.credentials.orn || '' }
              : null,
        });
        saveUser(user);
      }
      return { ok: true, user };
    })
    .catch((error) => ({
      ok: false,
      user: undefined,
      field: 'form',
      message: error.message || 'Could not reach the server.',
    }));
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
export function saveData(d, user = undefined) {
  user = user || currentUser();
  if (user) return write('data:' + user.id, strip(d));
  return false;
}
export function log(text, icon) {
  var d = data();
  if (!d) return;
  d.activity.unshift({ at: new Date().toISOString(), icon: icon || 'dot', text: text });
  d.activity = d.activity.slice(0, 40);
  saveData(d);
}

export function plan(user = undefined) {
  user = user || currentUser();
  const available = plans();
  const audience = user?.type === 'owner' ? 'developer' : user?.type || 'broker';
  const resolvedId = planIdForAudience(user?.plan, audience as 'broker' | 'agency' | 'developer');
  return available[resolvedId] || PLANS['broker-bronze'];
}

export function plans(): Record<string, PublicPlan> {
  const live = getPublicPlans();
  return Object.keys(live).length ? live : PLANS;
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
      })[0] || null
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

/* Selection with plan quota enforcement */
export function isSelected(id) {
  var d = data();
  return !!(
    d &&
    d.selected.some(function (s) {
      return s.id === id;
    })
  );
}
export function select(ids) {
  var d = data(),
    p = plan();
  if (!d) return { ok: false, added: 0 };
  ids = [].concat(ids);
  var added = 0,
    blocked = 0;
  ids.forEach(function (id) {
    if (
      d.selected.some(function (s) {
        return s.id === id;
      })
    )
      return;
    var n = network(id);
    if (!n || !n.available) return;
    if (p.selections && d.selected.length >= p.selections) {
      blocked++;
      return;
    }
    d.selected.push({ id: id, note: '', addedAt: new Date().toISOString() });
    added++;
  });
  saveData(d);
  if (added)
    log(
      added === 1
        ? 'Selected “' + network(ids[0]).title + '” from the broker network'
        : 'Selected ' + added + ' properties from the broker network',
      'bookmark',
    );
  return { ok: blocked === 0, added: added, blocked: blocked, used: d.selected.length, limit: p.selections };
}
export function deselect(ids) {
  var d = data();
  if (!d) return 0;
  ids = [].concat(ids);
  var before = d.selected.length;
  d.selected = d.selected.filter(function (s) {
    return ids.indexOf(s.id) === -1;
  });
  saveData(d);
  return before - d.selected.length;
}
export function setNote(id, note) {
  var d = data();
  if (!d) return;
  d.selected.forEach(function (s) {
    if (s.id === id) {
      s.note = note;
      s.updatedAt = new Date().toISOString();
    }
  });
  saveData(d);
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
export function fmtPrice(item) {
  if (!item || !item.price) return 'Price on request';
  return 'AED ' + fmtNumber(item.price) + (item.purpose === 'rent' ? ' /year' : '');
}
export function fmtAlt(item) {
  return currency() === 'USD' && item && item.price
    ? '≈ USD ' + fmtNumber(Math.round(item.price / USD_PEG)) + (item.purpose === 'rent' ? ' /year' : '')
    : '';
}
export function fmtSpecs(item) {
  var p = [];
  if (item.type) p.push(item.type);
  if (item.beds === 0 && /Apartment/.test(item.type || '')) p.push('Studio');
  else if (item.beds) p.push(item.beds + ' bed');
  if (item.baths) p.push(item.baths + ' bath');
  if (item.size) p.push(fmtNumber(item.size) + ' sqft');
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
  return read('enquiries', []).filter(function (q) {
    return String(q.brokerId) === String(user.id);
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
