'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import {
  agencies,
  brokerFromUser,
  currentUser,
  data,
  defaultPortfolio,
  listing as getListing,
  listingUrl,
  log,
  photoOf,
  saveListing,
  saveUser,
  uniqueSlug,
  userById,
} from '@/lib/store';
import { AREAS } from '@/config/reference';
import { uploadMediaDataURL } from '@/lib/mediaClient';
import { RX, clone, digits, fileToDataURL, slugify } from '@/lib/utils';
import { absUrl, copyText } from '@/lib/share';
import { routes } from '@/lib/routes';
import {
  ACHIEVEMENT_KINDS,
  CLIENT_SUG,
  LANG_SUG,
  REVIEW_PLATFORMS,
  SERVICE_SUG,
  SOCIAL_PLATFORMS,
  SPEC_SUG,
  WHY_EXAMPLES,
  WHY_ICONS,
  experienceErr,
  readiness,
  reviewErr,
  socialErr,
  uid,
  validUrl,
  withProfileDefaults,
} from '@/lib/brokerProfile';
import { BrokerPublicProfile } from './BrokerPublicProfile';
import { AiAutofill, type AiSummary } from './AiAutofill';
import './profiles.css';

/* Broker profile dashboard — React port of UI_Changes/emirate8-page-updates/single-broker-profile.html
 * (js/profile-builder.js). Same sections, markup and class names; styles from ./profiles.css.
 * The draft lives in user.portfolioDraft (auto-saved); Publish copies it to user.portfolio. */

const SECTIONS: [string, string, string][] = [
  ['identity', 'Identity & Branding', 'Your name, photo and the summary buyers see first.'],
  ['about', 'About & Expertise', 'Your story, the clients you help and how you work.'],
  ['areas', 'Service Areas', 'Communities you cover — entered once, used everywhere.'],
  ['credentials', 'Credentials & Trust', 'Your registration and other professional certifications.'],
  ['contact', 'Contact & Social Links', 'Business contact details and approved social profiles.'],
  ['reviews', 'Review Sources & Achievements', 'Links to your external review pages, plus awards and case studies.'],
  ['portfolio', 'Property Portfolio', 'Choose how your listings appear. Listings come from My Listings.'],
  ['visibility', 'Visibility & Optimization', 'Who can find your profile, its URL and readiness checks.'],
];
const SECTION_ICON: Record<string, string> = { identity: 'person-badge', about: 'journal-richtext', areas: 'geo-alt', credentials: 'patch-check', contact: 'telephone', reviews: 'star', portfolio: 'buildings', visibility: 'globe2' };
const LABELS: Record<string, string> = {
  displayName: 'Display name', title: 'Professional title', headline: 'Professional headline', intro: 'Short professional description',
  experience: 'Years of experience', languages: 'Spoken languages', location: 'Location', bio: 'Full biography', journey: 'Career introduction',
  experienceEntries: 'Professional journey', clients: 'Types of clients served', specialties: 'Property specializations', services: 'Services offered',
  whyPoints: 'Why work with me', approach: 'My professional approach', areas: 'Service areas', publicEmail: 'Business email', publicPhone: 'Business phone',
  whatsapp: 'WhatsApp Business number', preferred: 'Preferred contact method', booking: 'Appointment booking URL', website: 'Existing website',
  socials: 'Social profiles', slug: 'Public URL', credentials: 'Professional credentials',
};
function sectionOf(path: string) {
  const k = path.split('.')[0];
  if (['displayName', 'title', 'headline', 'intro', 'location', 'experience', 'languages', 'photo'].includes(k)) return 'identity';
  if (['bio', 'journey', 'experienceEntries', 'clients', 'specialties', 'services', 'whyPoints', 'approach'].includes(k)) return 'about';
  if (k === 'areas') return 'areas';
  if (k === 'credentials') return 'credentials';
  if (['publicEmail', 'publicPhone', 'whatsapp', 'preferred', 'booking', 'website', 'socials'].includes(k)) return 'contact';
  if (['reviewSources', 'achievements'].includes(k)) return 'reviews';
  if (k === 'defaultSort') return 'portfolio';
  return 'visibility';
}
const COMMUNITIES: string[] = Array.from(new Set(Object.values(AREAS as Record<string, string[]>).flat()));
const ST_LABEL: Record<string, string> = { draft: 'Draft', pending: 'Pending Review', published: 'Published', unpublished: 'Unpublished', sold: 'Sold', rented: 'Rented', archived: 'Archived' };
const CRED_LABEL: Record<string, string> = { not_submitted: 'Not Submitted', pending: 'Pending', verified: 'Verified', rejected: 'Rejected', expired: 'Expired' };
const PHONE = /^\+?[\d\s()-]{7,20}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_AI = ['title', 'intro', 'experience', 'languages', 'bio', 'specialties', 'publicEmail', 'publicPhone'];
const AI_NOTES: Record<string, string> = {
  intro: 'Write a short description in your own words — it isn’t taken from your sources.',
  headline: 'Write a one-line headline — it isn’t taken from your sources.',
};

type FS = Record<string, string>; // path → filled | edited | missing | verify | error
type Err = { path: string; section: string; msg: string; label: string };

const empty = (v: any) => (Array.isArray(v) ? !v.length : !String(v == null ? '' : v).trim());
const strip = (p: any) => {
  const c = withProfileDefaults(clone(p || {}));
  delete c.updatedAt;
  delete c.publishedAt;
  delete c.cover;
  delete c.coverPos;
  return c;
};

function featuredListings() {
  return data().listings.filter((l) => l.display.portfolioFeatured && l.status === 'published');
}
/** Keeps the saved order for listings that are still featured and appends newly featured ones. */
function featOrder(order: string[] | undefined) {
  const feats = featuredListings();
  const o = (order || []).filter((id) => feats.some((l) => l.id === id));
  feats.forEach((l) => {
    if (o.indexOf(l.id) < 0) o.push(l.id);
  });
  return o;
}
function initDraft() {
  const u = currentUser();
  if (!u.portfolio) {
    u.portfolio = defaultPortfolio(u, { slug: uniqueSlug(slugify(u.name), u.id) });
    saveUser(u);
  }
  const D = withProfileDefaults(clone(u.portfolioDraft || u.portfolio));
  D.featuredOrder = featOrder(D.featuredOrder);
  return D;
}
function isDirty(D: any) {
  const a = strip(D), b = strip(currentUser().portfolio);
  if (a.featuredOrder && !(b.featuredOrder || []).length && !a.featuredOrder.length) delete a.featuredOrder;
  if (!(b.featuredOrder || []).length && !(a.featuredOrder || []).length) { delete a.featuredOrder; delete b.featuredOrder; }
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Saves the draft on the user (or clears it when it matches the published profile). Returns false if storage refused it. */
function persistDraft(next: any) {
  const cur = currentUser();
  if (!cur) return true;
  if (isDirty(next)) cur.portfolioDraft = clone(next);
  else delete cur.portfolioDraft;
  saveUser(cur);
  const stored = userById(cur.id);
  return JSON.stringify(stored?.portfolioDraft || null) === JSON.stringify(cur.portfolioDraft || null);
}

/* ---------------- tag input ---------------- */
function TagInput({ id, path, values, onChange, suggest = [], placeholder = 'Type and press Enter', describedBy }: { id: string; path: string; values: string[]; onChange: (v: string[]) => void; suggest?: string[]; placeholder?: string; describedBy: string }) {
  const [text, setText] = useState('');
  const add = (v: string) => {
    v = v.replace(/,/g, '').trim().slice(0, 60);
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setText('');
  };
  const sug = suggest.filter((s) => values.indexOf(s) < 0);
  return (
    <>
      <div className="taginput" data-tags={path}>
        {values.map((t, i) => (
          <span className="tag" key={t}>
            {t}
            <button type="button" aria-label={'Remove ' + t} onClick={() => { onChange(values.filter((_, j) => j !== i)); document.getElementById(id)?.focus(); }}>
              <Icon name="x" />
            </button>
          </span>
        ))}
        <input
          id={id}
          aria-labelledby={id + '-l'}
          aria-describedby={describedBy}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1));
          }}
        />
      </div>
      {!!sug.length && (
        <div className="suggests" aria-label="Suggestions">
          {sug.slice(0, 8).map((s) => (
            <button key={s} type="button" onClick={() => add(s)}>
              <Icon name="plus" />
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- location picker (combobox) ---------------- */
function LocationPicker({ chosen, onAdd, invalid }: { chosen: string[]; onAdd: (name: string) => void; invalid: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  const ql = q.trim().toLowerCase();
  const opts = COMMUNITIES.filter((c) => !ql || c.toLowerCase().indexOf(ql) > -1);
  const custom = ql && !COMMUNITIES.some((c) => c.toLowerCase() === ql) ? q.trim() : null;
  const items = [...opts.map((c) => ({ name: c, label: c, chosen: chosen.includes(c), id: 'loc-o-' + slugify(c) })), ...(custom ? [{ name: custom, label: `Add “${custom}” as another UAE location`, chosen: chosen.includes(custom), id: 'loc-o-custom' }] : [])];
  const pickable = items.filter((x) => !x.chosen);
  const pick = (name: string) => {
    onAdd(name);
    setQ('');
    setIdx(-1);
  };
  return (
    <div className="locpick" ref={wrap}>
      <input
        className="input"
        id="loc-input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="loc-list"
        aria-activedescendant={open && pickable[idx] ? pickable[idx].id : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        placeholder="Search Dubai communities and other UAE locations"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setIdx(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setIdx((i) => Math.max(0, Math.min(pickable.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (pickable[idx]) pick(pickable[idx].name);
            else if (pickable.length === 1) pick(pickable[0].name);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <ul className="locpick__list" id="loc-list" role="listbox" aria-label="Locations" hidden={!open || !items.length}>
        {items.map((x) => (
          <li key={x.id} role="option" id={x.id} aria-selected={pickable[idx]?.id === x.id} aria-disabled={x.chosen} className={x.chosen ? 'is-chosen' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => !x.chosen && pick(x.name)}>
            {x.label}
            {x.chosen && <span className="xs">Added</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BrokerProfileBuilder() {
  useStoreVersion();
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const user = currentUser();
  const [D, setD] = useState<any>(initDraft);
  // The builder renders client-side only (it reads the signed-in user), so the hash can be read up front.
  const [current, setCurrent] = useState(() => {
    const h = typeof window === 'undefined' ? '' : location.hash.replace('#', '');
    return SECTIONS.some(([k]) => k === h) ? h : 'identity';
  });
  const [fs, setFs] = useState<FS>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = useState<{ D: any; fs: FS; notes: Record<string, string> } | null>(null);
  const [bar, setBar] = useState<'saved' | 'unsaved' | 'publishing' | 'published'>('saved');
  const [showErr, setShowErr] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const aiDone = useRef<((s: AiSummary) => void) | null>(null);
  const [preview, setPreview] = useState<'' | 'desktop' | 'mobile'>('');
  const [more, setMore] = useState(false);
  const [readyOpen, setReadyOpen] = useState<Record<string, boolean>>({ seo: true, ai: true, cro: true, trust: true });
  const [conflicts, setConflicts] = useState<null | { list: { path: string; cur: any; val: any }[]; choice: Record<number, 'keep' | 'ai'>; next: any; fs: FS; notes: Record<string, string>; applied: number }>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const secRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const latest = useRef(D);
  useEffect(() => {
    latest.current = D;
  }, [D]);

  /* current agency = team membership (set when an agency adds the broker), never typed */
  const currentAgency = user?.agency?.agencyRole === 'agency_broker' && user.agency.name ? { id: user.agency.agencyId, name: user.agency.name } : null;
  const agencyList = agencies();
  const dirty = isDirty(D);
  const published = currentUser().portfolio || {};
  const profilePath = '/brokers/' + encodeURIComponent(published.slug || D.slug);
  const verified = user.credentialStatus === 'verified';

  /* flush the pending draft save when leaving the page */
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        persistDraft(latest.current);
      }
    },
    [],
  );
  useEffect(() => {
    if (!preview) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [preview]);

  /* ---------------- draft persistence ---------------- */
  function persist(next: any) {
    if (!persistDraft(next)) toast('Browser storage is full — try a smaller photo.', { icon: 'exclamation-circle' });
  }
  const commit = (next: any) => {
    setD(next);
    setBar('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      persist(next);
      setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      setBar('saved');
    }, 650);
  };
  /** Field edits: AI-filled → Edited; Needs Your Input clears once a value is entered. */
  const touch = (path: string, v: any) => {
    const st = fs[path];
    if (st === 'filled' || st === 'verify') setFs({ ...fs, [path]: 'edited' });
    else if ((st === 'missing' || st === 'error') && !empty(v)) {
      const n = { ...fs };
      delete n[path];
      setFs(n);
    }
    if (notes[path] && st !== 'missing') {
      const n = { ...notes };
      delete n[path];
      setNotes(n);
    }
  };
  const set = (path: string, v: any) => {
    commit({ ...D, [path]: v });
    touch(path, v);
  };
  const mutate = (path: string, fn: (next: any) => void) => {
    const next = clone(D);
    fn(next);
    commit(next);
    touch(path, next[path]);
  };

  /* ---------------- validation ---------------- */
  const slugIssue = (s: string) => {
    if (!s || s.length < 3) return 'Use at least 3 characters.';
    if (s.length > 60) return 'Use 60 characters or fewer.';
    if (!SLUG.test(s)) return 'Use lowercase letters, numbers and single hyphens only.';
    if (uniqueSlug(s, user.id) !== s) return 'This address is already taken. Try ' + uniqueSlug(s, user.id) + '.';
    return '';
  };
  const validate = (): Err[] => {
    const E: Err[] = [];
    const e = (path: string, msg: string, label?: string) => E.push({ path, section: sectionOf(path), msg, label: label || LABELS[path] || path });
    if (empty(D.displayName)) e('displayName', 'Enter the name buyers should see.');
    if (empty(D.title)) e('title', 'Add your professional title.');
    if (empty(D.headline)) e('headline', 'Add a one-line headline.');
    else if (D.headline.length > 120) e('headline', 'Keep the headline to 120 characters.');
    if (empty(D.intro)) e('intro', 'Add a short professional description.');
    else if (D.intro.length > 280) e('intro', 'Keep the introduction to 280 characters.');
    if (empty(D.bio)) e('bio', 'Add a biography so visitors understand your work.');
    if (!(D.areas || []).length) e('areas', 'Add at least one service area.');
    if (D.publicEmail && !RX.email.test(D.publicEmail)) e('publicEmail', 'Enter an email like name@company.com.');
    if (D.publicPhone && (!PHONE.test(D.publicPhone) || digits(D.publicPhone).length < 9)) e('publicPhone', 'Enter a valid phone number with country code.');
    if (D.whatsapp && (!PHONE.test(D.whatsapp) || digits(D.whatsapp).length < 9)) e('whatsapp', 'Enter a valid WhatsApp number with country code.');
    if (empty(D.publicEmail) && empty(D.publicPhone)) e('publicEmail', 'Add a business email or phone.', 'Business contact');
    if (D.booking && !validUrl(D.booking)) e('booking', 'Enter a full URL starting with https://');
    if (D.website && !validUrl(D.website)) e('website', 'Enter a full URL starting with https://');
    (D.socials || []).forEach((s: any, i: number) => {
      const m = socialErr(s);
      if (m) E.push({ path: 'socials.' + i, section: 'contact', msg: m, label: (s.platform || 'Social') + ' link' });
    });
    (D.reviewSources || []).forEach((x: any, i: number) => {
      const m = reviewErr(x);
      if (m) E.push({ path: 'reviewSources.' + i, section: 'reviews', msg: m, label: (x.platform || 'Review') + ' link' });
    });
    (D.whyPoints || []).forEach((w: any, i: number) => {
      const t = String(w.title || '').trim(), d = String(w.desc || '').trim();
      if (t && !d) E.push({ path: 'whyPoints.' + i, section: 'about', msg: 'Add a short description for “' + t + '”.', label: 'Why work with me card ' + (i + 1) });
      if (!t && d) E.push({ path: 'whyPoints.' + i, section: 'about', msg: 'Add a title for this card.', label: 'Why work with me card ' + (i + 1) });
    });
    let curN = 0;
    (D.experienceEntries || []).forEach((x: any, i: number) => {
      if (x.current) curN++;
      const m = experienceErr(x, currentAgency);
      if (m) E.push({ path: 'experienceEntries.' + i, section: 'about', msg: m, label: 'Experience ' + (i + 1) });
    });
    if (curN > 1) e('experienceEntries', 'Only one entry can be your current position.', 'Professional journey');
    const si = slugIssue(D.slug || '');
    if (si) e('slug', si);
    return E;
  };
  const errors = showErr ? validate() : [];
  const errAt = (path: string) => errors.find((x) => x.path === path)?.msg || '';
  const hasErrors = errors.length > 0;

  const goto = (sec: string, focus = true, anchor?: string) => {
    setCurrent(sec);
    setTimeout(() => {
      if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
      else if (focus) {
        const h = secRef.current?.querySelector<HTMLElement>('#sec-title');
        h?.focus({ preventScroll: true });
        secRef.current?.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -90);
      }
    }, 0);
  };
  const focusErr = (er: Err) => {
    if (er.section !== current) setCurrent(er.section);
    setTimeout(() => {
      const el = secRef.current?.querySelector<HTMLElement>(`[data-field="${er.path}"] :is(input,textarea,select)`);
      if (el) {
        el.focus();
        el.scrollIntoView({ block: 'center' });
      }
    }, 30);
  };

  /* ---------------- publish / discard ---------------- */
  const publish = () => {
    const E = validate();
    setShowErr(true);
    if (E.length) {
      focusErr(E[0]);
      return;
    }
    setShowErr(false);
    setBar('publishing');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const cur = currentUser();
    const d = clone(D);
    d.updatedAt = d.publishedAt = new Date().toISOString();
    cur.portfolio = d;
    delete cur.portfolioDraft;
    saveUser(cur);
    log('Published portfolio changes', 'person-badge');
    setFs((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== 'filled' && v !== 'edited')));
    setSnapshot(null);
    setTimeout(() => setBar('published'), 300);
    toast(
      <>
        Published. Your public profile now shows these changes.{' '}
        <Link className="underline" href={'/brokers/' + encodeURIComponent(d.slug)}>
          View it
        </Link>
      </>,
    );
  };
  const discard = async () => {
    const when = published.publishedAt || published.updatedAt;
    const ok = await confirm({
      title: 'Discard changes?',
      body: 'Your draft goes back to the version published' + (when ? ' on ' + new Date(when).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '') + '. This can’t be undone.',
      ok: 'Discard changes',
      danger: true,
    });
    if (!ok) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const cur = currentUser();
    delete cur.portfolioDraft;
    saveUser(cur);
    setD(initDraft());
    setFs({});
    setNotes({});
    setSnapshot(null);
    setShowErr(false);
    setBar('saved');
    toast('Changes discarded.');
  };
  const viewPublic = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      persist(D);
    }
    router.push(profilePath);
  };
  const copyProfile = () => {
    const u = absUrl('/brokers/' + encodeURIComponent(D.slug));
    copyText(u).then(() => toast('Copied ' + u, { icon: 'link-45deg' }), () => window.prompt('Copy your profile link:', u));
  };

  /* ---------------- AI autofill (app's /api/profile-autofill) ---------------- */
  const applyAutofill = (suggestions: Record<string, any>, selected: string[]): Promise<AiSummary> => {
    const snap = { D: clone(D), fs: { ...fs }, notes: { ...notes } };
    const next = clone(D);
    const nfs: FS = { ...fs };
    const nnotes = { ...notes };
    const list: { path: string; cur: any; val: any }[] = [];
    let applied = 0;
    let brnFound = '';
    const mark = (path: string) => {
      nfs[path] = nfs[path] === 'edited' ? 'edited' : 'filled';
      applied++;
    };
    const lc = (v: any) => String(v || '').trim().toLowerCase();
    for (const key of selected) {
      let val = suggestions[key];
      let path = key;
      if (val == null || val === '') continue;
      /* ---- structured values: each goes to its own editor, never overwriting what the broker entered ---- */
      if (key === 'brn') {
        brnFound = String(val);
        continue;
      }
      if (key === 'agencyName') {
        // Current agency comes from team membership; without one, record it as the current journey entry.
        const hasCurrent = (next.experienceEntries || []).some((x: any) => x.current);
        const known = (next.experienceEntries || []).some((x: any) => lc(x.agencyName) === lc(val));
        if (!currentAgency && !hasCurrent && !known) {
          next.experienceEntries.push({ id: uid('ex'), agencyId: null, agencyName: String(val), position: suggestions.title || next.title || '', start: '', end: '', current: true, desc: '' });
          mark('experienceEntries');
          nnotes.experienceEntries = 'Added from your sources — add the start month.';
        }
        continue;
      }
      if (key === 'experienceEntries') {
        let added = 0;
        for (const x of val) {
          if ((next.experienceEntries || []).some((y: any) => lc(y.agencyName) === lc(x.agencyName) && (!x.position || !y.position || lc(y.position) === lc(x.position)))) continue;
          // A "current" entry is only kept when it can't contradict the Emirate08 team membership.
          const current = !!x.current && !currentAgency && !next.experienceEntries.some((y: any) => y.current);
          next.experienceEntries.push({ id: uid('ex'), agencyId: null, agencyName: x.agencyName, position: x.position || '', start: x.start || '', end: current ? '' : x.end || '', current, desc: x.desc || '' });
          added++;
        }
        if (added) mark('experienceEntries');
        continue;
      }
      if (key === 'socials' || key === 'reviewSources') {
        const ALIAS: Record<string, string> = { twitter: 'X', 'x (twitter)': 'X', linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', threads: 'Threads', google: 'Google Reviews', propertyfinder: 'Property Finder', 'property finder': 'Property Finder', bayut: 'Bayut' };
        let added = 0;
        for (const x of val) {
          if ((next[key] || []).some((y: any) => lc(y.url) === lc(x.url))) continue;
          next[key].push({ platform: ALIAS[lc(x.platform)] || x.platform, url: x.url });
          added++;
        }
        if (added) mark(key);
        continue;
      }
      if (key === 'whyPoints') {
        // Fill empty cards only; the broker's own cards stay as they are.
        const pts = next.whyPoints;
        let added = 0;
        for (const w of val) {
          const slot = pts.findIndex((p: any) => !String(p.title || '').trim() && !String(p.desc || '').trim());
          if (slot < 0) break;
          if (pts.some((p: any) => lc(p.title) === lc(w.title))) continue;
          pts[slot] = { ...pts[slot], title: String(w.title).slice(0, 40), desc: String(w.desc || '').slice(0, 120) };
          added++;
        }
        if (added) mark('whyPoints');
        continue;
      }
      if (key === 'achievements') {
        let added = 0;
        for (const x of val) {
          if ((next.achievements || []).some((y: any) => lc(y.title) === lc(x.title))) continue;
          next.achievements.push({ id: uid('ac'), kind: x.kind, title: x.title, detail: x.detail || '', date: x.date || '', evidence: 'Imported from your sources', approved: false });
          added++;
        }
        if (added) mark('achievements');
        continue;
      }
      if (key === 'areaNotes') {
        let added = 0;
        for (const x of val) {
          if (!next.areas.includes(x.name)) {
            next.areas.push(x.name);
            next.areaMeta[x.name] = { primary: next.areas.filter((a: string) => next.areaMeta[a]?.primary).length < 3, note: '' };
          }
          if (!next.areaMeta[x.name]?.note) {
            next.areaMeta[x.name] = { ...(next.areaMeta[x.name] || {}), note: String(x.note).slice(0, 160) };
            added++;
          }
        }
        if (added) mark('areas');
        continue;
      }
      if (key === 'agencyWebsite') {
        // The agency's site is only a fallback when no personal website was found.
        if (suggestions.website || !validUrl(String(val))) continue;
        path = 'website';
      }
      if (key === 'credentials') {
        const have = (next.credentials || []).map((c: any) => String(c.label).toLowerCase());
        const add = (val || []).filter((c: any) => c && c.label && have.indexOf(String(c.label).toLowerCase()) < 0).map((c: any) => ({ label: c.label, value: c.value || '', issuer: '', expires: '', verified: false }));
        if (add.length) {
          next.credentials = [...(next.credentials || []), ...add];
          nfs.credentials = 'filled';
          applied++;
        }
        continue;
      }
      if (key === 'areas') {
        const prim = () => next.areas.filter((a: string) => next.areaMeta[a]?.primary).length;
        let added = 0;
        for (const a of val || []) {
          if (!a || next.areas.includes(a)) continue;
          next.areaMeta[a] = { primary: prim() < 3, note: '' };
          next.areas.push(a);
          added++;
        }
        if (added) {
          nfs.areas = nfs.areas === 'edited' ? 'edited' : 'filled';
          applied++;
        }
        continue;
      }
      if (key === 'experience') val = digits(String(val)) ? +digits(String(val)) : '';
      const cur = next[path];
      if (Array.isArray(val)) {
        const arr = (cur || []).slice();
        let added = 0;
        val.forEach((x: any) => {
          if (!arr.some((y: any) => String(y).toLowerCase() === String(x).toLowerCase())) {
            arr.push(x);
            added++;
          }
        });
        if (added) {
          next[path] = arr;
          nfs[path] = empty(cur) ? 'filled' : nfs[path] === 'edited' ? 'edited' : 'filled';
          applied++;
        }
      } else if (empty(cur)) {
        next[path] = val;
        nfs[path] = 'filled';
        applied++;
      } else if (String(cur).trim() !== String(val).trim()) list.push({ path, cur, val });
    }
    for (const p of REQUIRED_AI)
      if (empty(next[p]) && nfs[p] !== 'error') {
        nfs[p] = 'missing';
        nnotes[p] = nnotes[p] || AI_NOTES[p] || 'Not found in your sources — please add it.';
      }
    if (nfs.whyPoints === 'filled') nnotes.whyPoints = 'Written from facts in your sources — check the wording.';
    setSnapshot(snap);
    // The BRN belongs to Account → Credentials (verified there), so it's suggested rather than filled.
    if (brnFound && !user.credentials?.brn)
      setTimeout(() => toast(<>Your sources list BRN {brnFound}. Add it in <Link className="underline" href="/account#credentials">Account → Credentials</Link> to get the Verified badge.</>, { icon: 'patch-check' }), 1500);
    return new Promise<AiSummary>((resolve) => {
      if (list.length) {
        // Different values for fields the broker already filled: ask first, then report.
        aiDone.current = resolve;
        setConflicts({ list, choice: {}, next, fs: nfs, notes: nnotes, applied });
        return;
      }
      resolve(finishAi(next, nfs, nnotes, applied, 0));
    });
  };
  /** Scrolls to the editor and plays the "landing" highlight on the AI-filled fields. */
  const reviewForm = () => {
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      secRef.current?.querySelectorAll('.ai-field[data-ai="filled"],.ai-field[data-ai="verify"],.ai-field[data-ai="missing"]').forEach((f, k) => {
        (f as HTMLElement).style.setProperty('--i', String(k));
        f.classList.add('is-landing');
      });
      setTimeout(() => secRef.current?.querySelectorAll('.is-landing').forEach((f) => f.classList.remove('is-landing')), 2600);
      secRef.current?.querySelector<HTMLElement>('#sec-title')?.focus({ preventScroll: true });
    }, 30);
  };
  const finishAi = (next: any, nfs: FS, nnotes: Record<string, string>, applied: number, kept: number): AiSummary => {
    commit(next);
    setFs(nfs);
    setNotes(nnotes);
    setCurrent('identity');
    const miss = Object.values(nfs).filter((v) => v === 'missing').length;
    toast('Autofill applied: ' + applied + ' item' + (applied === 1 ? '' : 's') + ' added' + (miss ? ', ' + miss + ' need your input' : '') + '. Nothing is published yet.');
    return { filled: applied, missing: miss, kept };
  };
  const resolveConflicts = () => {
    if (!conflicts) return;
    const { list, choice, next, fs: nfs, notes: nnotes } = conflicts;
    let applied = conflicts.applied, kept = 0;
    list.forEach((c, k) => {
      if (choice[k] === 'ai') {
        next[c.path] = c.val;
        nfs[c.path] = 'filled';
        applied++;
      } else kept++;
    });
    setConflicts(null);
    const sum = finishAi(next, nfs, nnotes, applied, kept);
    aiDone.current?.(sum);
    aiDone.current = null;
  };
  const undoAI = () => {
    if (!snapshot) return;
    commit(snapshot.D);
    setFs(snapshot.fs);
    setNotes(snapshot.notes);
    setSnapshot(null);
    toast('AI changes undone. Your previous details are restored.');
  };

  /* ---------------- photo ---------------- */
  /* ---------------- photo (click or drop; uploaded to the media library) ---------------- */
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoDrag, setPhotoDrag] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const uploadPhoto = async (f?: File | null) => {
    if (!f || photoBusy) return;
    setPhotoErr('');
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setPhotoErr('Use a JPG, PNG or WebP image.');
    if (f.size > 5 * 1048576) return setPhotoErr('Images must be 5 MB or smaller.');
    setPhotoBusy(true);
    try {
      const s = await fileToDataURL(f, 480, 0.85).catch(() => null);
      if (!s) throw new Error('That file isn’t an image we can use.');
      const media = await uploadMediaDataURL(s, f.name, f.name);
      set('photo', media.url);
      toast('Photo updated in your draft.', { icon: 'person-check' });
    } catch (error) {
      setPhotoErr(error instanceof Error ? error.message : 'Could not upload this image.');
    } finally {
      setPhotoBusy(false);
    }
  };
  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    uploadPhoto(f);
  };

  /* ---------------- field renderers (same markup as the demo) ---------------- */
  const fid = (path: string) => 'f-' + path.replace(/\./g, '-');
  const TAGS = (
    <>
      <span className="ai-tag ai-tag--filled"><Icon name="stars" />AI-Filled</span>
      <span className="ai-tag ai-tag--edited"><Icon name="pencil" />Edited</span>
      <span className="ai-tag ai-tag--missing"><Icon name="exclamation-triangle-fill" />Needs Your Input</span>
      <span className="ai-tag ai-tag--verify"><Icon name="exclamation-triangle-fill" />Needs Your Input · check</span>
      <span className="ai-tag ai-tag--error"><Icon name="x-octagon-fill" />Error</span>
    </>
  );
  type O = { req?: boolean; full?: boolean; max?: number; guide?: string; help?: string; group?: boolean; type?: string; ph?: string; auto?: string; rows?: number; min?: number; maxNum?: number };
  const desc = (path: string, o: O) => {
    const id = fid(path);
    return id + '-ai' + (o.guide ? ' ' + id + '-g' : '') + (o.help ? ' ' + id + '-h' : '') + ' ' + id + '-err';
  };
  const wrap = (path: string, label: string, control: ReactNode, o: O = {}) => {
    const id = fid(path);
    const err = errAt(path);
    const st = fs[path] || '';
    return (
      <div className={'field ai-field' + (o.full ? ' full' : '') + (notes[path] ? ' has-reason' : '') + (err ? ' has-error' : '')} data-ai={st} data-field={path}>
        <div className="field-head">
          {o.group ? (
            <span className="label" id={id + '-l'}>
              {label}
              {o.req ? <><span className="req" aria-hidden="true">*</span><span className="sr-only"> (required)</span></> : <> <span className="opt">(optional)</span></>}
            </span>
          ) : (
            <label className="label" htmlFor={id}>
              {label}
              {o.req ? <><span className="req" aria-hidden="true">*</span><span className="sr-only"> (required)</span></> : <> <span className="opt">(optional)</span></>}
            </label>
          )}
          <span className="ai-tags" id={id + '-ai'}>
            {TAGS}
            <button type="button" className="ai-confirm" onClick={() => { setFs({ ...fs, [path]: 'edited' }); toast('Marked as confirmed by you.'); }}>
              Confirm
            </button>
          </span>
          {o.max ? <span className="count">{String(D[path] || '').length} / {o.max}</span> : null}
        </div>
        {o.guide && <p className="guide" id={id + '-g'}>{o.guide}</p>}
        {control}
        {o.help && <p className="hint" id={id + '-h'}>{o.help}</p>}
        <p className="ai-missing-hint"><Icon name="exclamation-triangle" />Not found in what you shared — please add it yourself.</p>
        <p className="ai-error-hint"><Icon name="x-octagon" />The value in your sources wasn’t valid — please enter it yourself.</p>
        {notes[path] && <p className="ai-reason"><Icon name="info-circle" /><span>{notes[path]}</span></p>}
        <p className="ferr" id={id + '-err'} role="alert"><Icon name="exclamation-circle" /><span>{err}</span></p>
      </div>
    );
  };
  const fText = (path: string, label: string, o: O = {}) =>
    wrap(
      path,
      label,
      <input
        className="input"
        id={fid(path)}
        type={o.type || 'text'}
        value={D[path] ?? ''}
        maxLength={o.max}
        min={o.min}
        max={o.maxNum}
        placeholder={o.ph}
        autoComplete={o.auto}
        aria-required={o.req || undefined}
        aria-invalid={errAt(path) ? true : undefined}
        aria-describedby={desc(path, o)}
        onChange={(e) => set(path, o.type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value)}
      />,
      o,
    );
  const fArea = (path: string, label: string, o: O = {}) =>
    wrap(
      path,
      label,
      <textarea className="textarea" id={fid(path)} rows={o.rows || 4} maxLength={o.max} placeholder={o.ph} aria-required={o.req || undefined} aria-invalid={errAt(path) ? true : undefined} aria-describedby={desc(path, o)} value={D[path] || ''} onChange={(e) => set(path, e.target.value)} />,
      o,
    );
  const fSelect = (path: string, label: string, opts: [string, string][], o: O = {}) =>
    wrap(
      path,
      label,
      <select className="select" id={fid(path)} aria-describedby={desc(path, o)} value={D[path] || ''} onChange={(e) => set(path, e.target.value)}>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>,
      o,
    );
  const fTags = (path: string, label: string, suggest: string[], o: O = {}) =>
    wrap(path, label, <TagInput id={fid(path)} path={path} values={D[path] || []} onChange={(v) => set(path, v)} suggest={suggest} describedBy={desc(path, o)} />, { ...o, group: true });
  const rowErr = (msg: string, show = !!msg) => (
    <p className="ferr" role="alert" style={{ display: show ? 'flex' : 'none' }}>
      <Icon name="exclamation-circle" />
      <span>{msg}</span>
    </p>
  );
  const emptyBox = (icon: string, children: ReactNode) => (
    <div className="empty-box">
      {icon && <Icon name={icon} />}
      {children}
    </div>
  );

  /* ---------------- sections ---------------- */
  const secIdentity = () => (
    <>
      <div className={'photo-up' + (photoDrag ? ' is-drag' : '')} data-field="photo">
        <label
          className={'photo-up__avatar' + (D.photo ? ' has-photo' : '') + (photoBusy ? ' is-busy' : '')}
          htmlFor="up-photo"
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes('Files')) {
              e.preventDefault();
              setPhotoDrag(true);
            }
          }}
          onDragLeave={() => setPhotoDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setPhotoDrag(false);
            uploadPhoto(e.dataTransfer.files?.[0]);
          }}
        >
          {D.photo ? (
            <img src={D.photo} alt={'Profile photo of ' + (D.displayName || 'you')} />
          ) : (
            <span className="photo-up__initials" aria-hidden="true">
              {(D.displayName || user.name || '?').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="photo-up__overlay" aria-hidden="true">
            <Icon name={photoBusy ? 'arrow-repeat' : 'camera'} />
            {photoBusy ? 'Uploading…' : D.photo ? 'Change' : 'Add photo'}
          </span>
          <span className="photo-up__badge" aria-hidden="true">
            <Icon name={D.photo ? 'pencil-fill' : 'plus-lg'} />
          </span>
        </label>
        <input className="file-hidden" type="file" id="up-photo" accept="image/jpeg,image/png,image/webp" aria-labelledby="up-photo-l" aria-describedby="up-photo-h" disabled={photoBusy} onChange={onPhoto} />
        <div className="photo-up__info">
          <span className="label" id="up-photo-l">
            Profile photograph <span className="opt">(recommended)</span>
          </span>
          <p className="photo-up__lead" id="up-photo-h">
            {D.photo ? 'This photo appears on your public profile, listing cards and in Find an Agent.' : 'Profiles with a photo get noticeably more enquiries. Without one, your initials are shown.'}
          </p>
          <ul className="photo-up__tips">
            <li><Icon name="check2" />Clear, recent head-and-shoulders shot</li>
            <li><Icon name="check2" />Plain background, good light, facing the camera</li>
            <li><Icon name="check2" />JPG, PNG or WebP · up to 5 MB · square works best</li>
          </ul>
          <div className="photo-up__actions">
            <label className={'btn btn-outline btn-sm' + (photoBusy ? ' is-disabled' : '')} htmlFor="up-photo">
              <Icon name={D.photo ? 'arrow-repeat' : 'upload'} />
              {D.photo ? 'Change photo' : 'Upload photo'}
            </label>
            {D.photo && !photoBusy && (
              <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => { set('photo', ''); setPhotoErr(''); }}>
                <Icon name="trash3" />
                Remove
              </button>
            )}
            <span className="photo-up__drop">or drag a photo onto the circle</span>
          </div>
          {photoErr && (
            <p className="photo-up__err" role="alert">
              <Icon name="exclamation-circle" />
              {photoErr}
            </p>
          )}
        </div>
      </div>
      <div className="fgrid" style={{ marginTop: 22 }}>
        {fText('displayName', 'Display name', { req: true, auto: 'name', help: 'Used as your page title (H1) and across Emirate08.' })}
        {fText('title', 'Professional title', { req: true, ph: 'e.g. Senior Real Estate Consultant', help: 'Shown directly below your name.' })}
        {fText('headline', 'Professional headline', { req: true, full: true, max: 120, ph: 'One line about who you help and where', help: 'Your main value proposition in the hero.' })}
        {fArea('intro', 'Short Professional Description', { req: true, full: true, max: 280, rows: 3, help: 'Shown in your public profile hero, directly below your title, and in Find an Agent summaries. Two sentences. Your longer story goes in About.' })}
        {fText('location', 'Location', { ph: 'e.g. Dubai, UAE', help: 'Shown under your name on the public profile.' })}
        {fText('experience', 'Years of experience', { type: 'number', min: 0, maxNum: 60, help: 'Years working in real estate.' })}
        {fTags('languages', 'Spoken languages', LANG_SUG, { help: 'Only languages you can advise clients in.' })}
      </div>
    </>
  );

  const whyEditor = () => {
    const pts = D.whyPoints;
    const setWhy = (i: number, k: string, v: string) =>
      mutate('whyPoints', (n) => {
        n.whyPoints[i] = { ...n.whyPoints[i], [k]: k === 'title' ? v.slice(0, 40) : k === 'desc' ? v.slice(0, 120) : v };
      });
    return (
      <div className="field ai-field full" data-ai={fs.whyPoints || ''} data-field="whyPoints">
        <div className="field-head">
          <span className="label" id="why-l">
            Why work with me <span className="opt">(four cards)</span>
          </span>
          <span className="ai-tags">{TAGS}</span>
        </div>
        <p className="guide">What do clients appreciate most about working with you? Each card needs a short title and a one-line description.</p>
        {notes.whyPoints && <p className="ai-reason"><Icon name="info-circle" /><span>{notes.whyPoints}</span></p>}
        <div className="why-edit" role="group" aria-labelledby="why-l">
          {pts.map((w: any, i: number) => {
            const err = errAt('whyPoints.' + i);
            return (
              <div key={i} className={'why-row' + (err ? ' has-error' : '')} data-field={'whyPoints.' + i}>
                <span className="why-row__icon" aria-hidden="true">
                  <Icon name={w.icon} />
                </span>
                <label className="sr-only" htmlFor={'why-i-' + i}>Icon for card {i + 1}</label>
                <select className="select" id={'why-i-' + i} value={w.icon} onChange={(e) => setWhy(i, 'icon', e.target.value)}>
                  {WHY_ICONS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor={'why-t-' + i}>Card {i + 1} title</label>
                <input className="input" id={'why-t-' + i} maxLength={40} value={w.title} placeholder={'e.g. ' + WHY_EXAMPLES[i][0]} aria-invalid={err ? true : undefined} onChange={(e) => setWhy(i, 'title', e.target.value)} />
                <label className="sr-only" htmlFor={'why-d-' + i}>Card {i + 1} description</label>
                <textarea className="textarea why-row__desc" id={'why-d-' + i} maxLength={120} rows={2} placeholder={'e.g. ' + WHY_EXAMPLES[i][1]} value={w.desc || ''} onChange={(e) => setWhy(i, 'desc', e.target.value)} />
                {rowErr(err)}
              </div>
            );
          })}
        </div>
        <p className="hint">Titles up to 40 characters, descriptions up to 120. Empty cards are hidden on the public page.</p>
        <p className="ai-missing-hint"><Icon name="exclamation-triangle" />Not found in what you shared — please add it yourself.</p>
      </div>
    );
  };

  const journeyEditor = () => {
    const ex = D.experienceEntries;
    const setEx = (i: number, patch: any) => mutate('experienceEntries', (n) => { n.experienceEntries[i] = { ...n.experienceEntries[i], ...patch }; });
    return (
      <div className={'field ai-field full' + (errAt('experienceEntries') ? ' has-error' : '') + (notes.experienceEntries ? ' has-reason' : '')} data-ai={fs.experienceEntries || ''} data-field="experienceEntries">
        <div className="field-head">
          <span className="label" id="exp-l">
            Experience entries <span className="opt">(current and previous agencies)</span>
          </span>
          <span className="ai-tags">{TAGS}</span>
        </div>
        {notes.experienceEntries && <p className="ai-reason"><Icon name="info-circle" /><span>{notes.experienceEntries}</span></p>}
        <p className="guide">Add each agency you have worked for. Choose a registered Emirate08 agency to link its logo and profile, or type the name of an agency that isn’t on Emirate08.</p>
        <div className="info-note">
          <Icon name="diagram-3" />
          <span>
            Current agency on Emirate08: <b>{currentAgency ? currentAgency.name : 'none (independent broker)'}</b>. This is set when an agency adds you to its team, and is what your hero, listings and the agency’s Team page use. A “current” entry here must match it.
          </span>
        </div>
        <ul className="exp-list" aria-labelledby="exp-l">
          {ex.map((x: any, i: number) => {
            const other = !x.agencyId;
            const err = errAt('experienceEntries.' + i);
            return (
              <li key={x.id || i} className={'exp-item rep-item' + (err ? ' has-error' : '')} data-field={'experienceEntries.' + i}>
                <div className="exp-grid">
                  <div>
                    <label className="label" htmlFor={'ex-a-' + i}>Agency</label>
                    <select className="select" id={'ex-a-' + i} value={x.agencyId || ''} onChange={(e) => { const a = agencyList.find((g: any) => String(g.id) === e.target.value); setEx(i, { agencyId: a ? a.id : null, agencyName: a ? a.name : '' }); }}>
                      {agencyList.map((a: any) => (
                        <option key={a.id} value={String(a.id)}>{a.name} (on Emirate08)</option>
                      ))}
                      <option value="">Other agency (not on Emirate08)</option>
                    </select>
                  </div>
                  {other && (
                    <div>
                      <label className="label" htmlFor={'ex-n-' + i}>Agency name</label>
                      <input className="input" id={'ex-n-' + i} maxLength={80} value={x.agencyName || ''} onChange={(e) => setEx(i, { agencyName: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className="label" htmlFor={'ex-p-' + i}>Position / designation</label>
                    <input className="input" id={'ex-p-' + i} maxLength={80} value={x.position || ''} placeholder="e.g. Senior Real Estate Consultant" onChange={(e) => setEx(i, { position: e.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor={'ex-s-' + i}>Start month</label>
                    <input className="input" type="month" id={'ex-s-' + i} value={x.start || ''} onChange={(e) => setEx(i, { start: e.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor={'ex-e-' + i}>End month</label>
                    <input className="input" type="month" id={'ex-e-' + i} value={x.current ? '' : x.end || ''} disabled={x.current} aria-describedby={x.current ? 'ex-c-h-' + i : undefined} onChange={(e) => setEx(i, { end: e.target.value })} />
                  </div>
                  <div className="exp-cur">
                    <label className="check">
                      <input type="checkbox" id={'ex-c-' + i} checked={!!x.current} onChange={(e) => setEx(i, { current: e.target.checked, ...(e.target.checked ? { end: '' } : {}) })} />I currently work here
                    </label>
                    {x.current && <p className="hint" id={'ex-c-h-' + i}>No end date needed for a current position.</p>}
                  </div>
                  <div className="exp-desc">
                    <label className="label" htmlFor={'ex-d-' + i}>Description <span className="opt">(optional)</span></label>
                    <textarea className="textarea" id={'ex-d-' + i} rows={2} maxLength={300} value={x.desc || ''} onChange={(e) => setEx(i, { desc: e.target.value })} />
                  </div>
                </div>
                {rowErr(err)}
                <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => { mutate('experienceEntries', (n) => n.experienceEntries.splice(i, 1)); toast('Experience entry removed.'); }}>
                  <Icon name="trash3" />
                  Remove<span className="sr-only"> experience {i + 1}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { mutate('experienceEntries', (n) => n.experienceEntries.push({ id: uid('ex'), agencyId: null, agencyName: '', position: '', start: '', end: '', current: false, desc: '' })); setTimeout(() => document.getElementById('ex-a-' + ex.length)?.focus(), 30); }}>
          <Icon name="plus-lg" />
          Add experience
        </button>
        <p className="hint">Entries are shown newest first. Previous agencies are history only — they never become your current affiliation.</p>
        <p className="ferr" role="alert"><Icon name="exclamation-circle" /><span>{errAt('experienceEntries')}</span></p>
      </div>
    );
  };

  const secAbout = () => (
    <div className="fgrid">
      {fArea('bio', 'Full biography', { req: true, full: true, max: 2000, rows: 5, guide: 'In your own words: who you are and the kind of buyers you help.', help: 'Shown as “About Me”. Write it differently from your short introduction.' })}
      {fArea('journey', 'Career introduction', { full: true, rows: 3, guide: 'Shown at the top of “My Professional Journey”. How did you start in real estate, and how has your work developed?' })}
      {journeyEditor()}
      {fTags('clients', 'Types of clients served', CLIENT_SUG, { full: true, guide: 'What kind of clients do you usually help?' })}
      {fTags('specialties', 'Property specializations', SPEC_SUG, { full: true, guide: 'Which property segments are you most experienced in?' })}
      {fTags('services', 'Services offered', SERVICE_SUG, { full: true })}
      {whyEditor()}
      {fArea('approach', 'My professional approach', { full: true, rows: 3, guide: 'Describe how you guide buyers through a property purchase.' })}
      <div className="info-note full">
        <Icon name="trophy" />
        <span>
          Notable achievements and real examples / case studies are entered once in{' '}
          <button type="button" className="linkish" onClick={() => goto('reviews')}>
            Review Sources & Achievements
          </button>
          , so they are not repeated here.
        </span>
      </div>
    </div>
  );

  const secAreas = () => {
    const a: string[] = D.areas || [];
    const meta = D.areaMeta || {};
    const prim = a.filter((x) => meta[x]?.primary).length;
    const own = data().listings.filter((l) => l.status === 'published' && l.display.visible !== false && a.indexOf(l.area) < 0);
    const outside = own.map((l) => l.area).filter((v, i, s) => v && s.indexOf(v) === i);
    const err = errAt('areas');
    const addArea = (name: string) => {
      if (a.includes(name)) return;
      mutate('areas', (n) => {
        n.areas.push(name);
        n.areaMeta[name] = { primary: prim < 3, note: '' };
      });
      toast(name + ' added' + (prim < 3 ? ' as a primary area.' : '.'));
    };
    return (
      <>
        <div className="info-note">
          <Icon name="geo-alt" />
          <span>Locations are saved once. The hero shows your primary areas, the About tab shows your notes, and property filters use the real locations of your listings.</span>
        </div>
        <div className={'field ai-field' + (err ? ' has-error' : '')} data-ai={fs.areas || ''} data-field="areas" style={{ marginTop: 18 }}>
          <div className="field-head">
            <label className="label" htmlFor="loc-input">
              Add a service area<span className="req" aria-hidden="true">*</span>
            </label>
            <span className="ai-tags">{TAGS}</span>
          </div>
          <LocationPicker chosen={a} onAdd={addArea} invalid={!!err} />
          <p className="ferr" id="f-areas-err" role="alert"><Icon name="exclamation-circle" /><span>{err}</span></p>
          <div className="count-line">
            <span>{a.length} selected · {prim} primary</span>
            <span>Mark up to 3 as primary for the hero</span>
          </div>
          <div className="loc-rows">
            {a.length
              ? a.map((name, i) => (
                  <div className="loc-row" key={name}>
                    <b>{name}</b>
                    <label className="check">
                      <input type="checkbox" checked={!!meta[name]?.primary} disabled={!meta[name]?.primary && prim >= 3} onChange={(e) => mutate('areas', (n) => { n.areaMeta[name] = { ...(n.areaMeta[name] || {}), primary: e.target.checked }; })} />
                      Primary area
                    </label>
                    <button type="button" className="btn btn-ghost btn-sm danger" aria-label={'Remove ' + name} onClick={() => { mutate('areas', (n) => { n.areas.splice(i, 1); delete n.areaMeta[name]; }); toast(name + ' removed.'); }}>
                      <Icon name="x-lg" />
                    </button>
                    <label className="sr-only" htmlFor={'area-note-' + i}>Local expertise note for {name}</label>
                    <input className="input" id={'area-note-' + i} maxLength={160} value={meta[name]?.note || ''} placeholder="Optional: short local-expertise note (max 160 characters)" onChange={(e) => mutate('areas', (n) => { n.areaMeta[name] = { ...(n.areaMeta[name] || {}), note: e.target.value }; })} />
                  </div>
                ))
              : emptyBox('geo', 'No service areas yet. Search above to add the communities you know best.')}
          </div>
        </div>
        {!!outside.length && (
          <div className="info-note" style={{ marginTop: 14 }}>
            <Icon name="exclamation-triangle" />
            <span>
              {own.length} published listing(s) are in areas not listed here: {outside.join(', ')}. Add them if you genuinely cover these areas.
            </span>
          </div>
        )}
      </>
    );
  };

  const secCredentials = () => {
    const brn = user.credentials?.brn || '';
    const expires = user.credentials?.expiry || '';
    const st = !brn ? 'not_submitted' : user.credentialStatus === 'verified' ? (expires && expires < new Date().toISOString().slice(0, 10) ? 'expired' : 'verified') : user.credentialStatus === 'rejected' ? 'rejected' : 'pending';
    const icon = st === 'verified' ? 'patch-check-fill' : st === 'not_submitted' ? 'patch-question' : 'patch-exclamation';
    const extra = D.credentials || [];
    const setCred = (i: number, patch: any) => mutate('credentials', (n) => { n.credentials[i] = { ...n.credentials[i], ...patch, verified: false }; });
    return (
      <>
        <p className="sub-h">Registration from your account</p>
        <div className="cred-primary">
          <span style={st === 'verified' ? undefined : { color: 'var(--warn)' }}>
            <Icon name={icon} />
          </span>
          <div>
            <b>RERA Broker Registration (BRN)</b> <span className={'state-badge sb-' + st}>{CRED_LABEL[st]}</span>
            <dl>
              <div><dt>Issuer</dt><dd>Dubai Land Department / RERA</dd></div>
              <div><dt>Number</dt><dd>{brn || '—'}</dd></div>
              <div><dt>Expires</dt><dd>{expires || '—'}</dd></div>
              <div><dt>Document</dt><dd>{st === 'verified' ? 'Checked' : brn ? 'Uploaded' : 'Not uploaded'}</dd></div>
            </dl>
          </div>
          <Link className="btn btn-outline btn-sm" href="/account#credentials">
            <Icon name="box-arrow-up-right" />
            Manage Credentials
          </Link>
        </div>
        <div className="info-note" style={{ marginTop: 10 }}>
          <Icon name="info-circle" />
          <span>These records live in Account → Credentials and are not duplicated here. A verified badge appears publicly only when the underlying record is verified. Emirate08 does not simulate government verification.</span>
        </div>
        <p className="sub-h">Additional certifications</p>
        <div className="rep">
          {extra.length
            ? extra.map((x: any, i: number) => {
                const ok = !!x.verified && verified;
                return (
                  <div className="rep-item" key={i} data-field={'credentials.' + i}>
                    <div className="rep-item__head">
                      <b>{x.label || 'New certification'}</b>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={'state-badge sb-' + (ok ? 'verified' : 'not_submitted')}>{ok ? 'Verified' : 'Not Submitted'}</span>
                        <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => mutate('credentials', (n) => n.credentials.splice(i, 1))}>
                          Remove
                        </button>
                      </span>
                    </div>
                    <div className="rep-grid">
                      <div><label className="label" htmlFor={'cx-n-' + i}>Credential name</label><input className="input" id={'cx-n-' + i} value={x.label || ''} onChange={(e) => setCred(i, { label: e.target.value })} /></div>
                      <div><label className="label" htmlFor={'cx-i-' + i}>Issuer</label><input className="input" id={'cx-i-' + i} value={x.issuer || ''} onChange={(e) => setCred(i, { issuer: e.target.value })} /></div>
                      <div><label className="label" htmlFor={'cx-r-' + i}>Registration / certificate number</label><input className="input" id={'cx-r-' + i} value={x.value || ''} onChange={(e) => setCred(i, { value: e.target.value })} /></div>
                      <div><label className="label" htmlFor={'cx-e-' + i}>Expiration date <span className="opt">(optional)</span></label><input className="input" type="date" id={'cx-e-' + i} value={x.expires || ''} onChange={(e) => setCred(i, { expires: e.target.value })} /></div>
                      <div className="full"><p className="hint">Status changes to Verified only after Emirate08 reviews the supporting document. Send documents through <Link className="link" href="/account#credentials">Account → Credentials</Link>.</p></div>
                    </div>
                  </div>
                );
              })
            : emptyBox('', 'No additional certifications yet.')}
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => { mutate('credentials', (n) => { n.credentials = [...(n.credentials || []), { label: '', issuer: '', value: '', expires: '', verified: false }]; }); setTimeout(() => document.getElementById('cx-n-' + extra.length)?.focus(), 30); }}>
          <Icon name="plus-lg" />
          Add certification
        </button>
      </>
    );
  };

  const secContact = () => {
    const socials = D.socials || [];
    return (
      <>
        <div className="info-note">
          <Icon name="shield-lock" />
          <span>Use business details only. Your private account email and phone are never shown automatically.</span>
        </div>
        <div className="fgrid" style={{ marginTop: 18 }}>
          {fText('publicEmail', 'Business email', { type: 'email', auto: 'email', help: 'Enquiries are also delivered to your Emirate08 inbox.' })}
          {fText('publicPhone', 'Business phone', { type: 'tel', auto: 'tel', ph: '+971' })}
          {fText('whatsapp', 'WhatsApp Business number', { type: 'tel', ph: '+971', help: 'Include the country code. Powers the WhatsApp buttons.' })}
          {fSelect('preferred', 'Preferred contact method', [['whatsapp', 'WhatsApp'], ['call', 'Phone call'], ['email', 'Email'], ['form', 'Enquiry form']])}
          {fText('booking', 'Appointment booking URL', { type: 'url', ph: 'https://' })}
          {fText('website', 'Existing website', { type: 'url', ph: 'https://' })}
        </div>
        <p className="info-note" style={{ marginTop: 12 }}>
          <Icon name="person-lines-fill" />
          <span>Add a business email or phone so visitors can reach you.</span>
        </p>
        <p className="sub-h">Social media profiles</p>
        <div className="rep" data-field="socials">
          {socials.length
            ? socials.map((s: any, i: number) => {
                const known = SOCIAL_PLATFORMS.indexOf(s.platform) > -1;
                const m = socialErr(s);
                const setS = (patch: any) => mutate('socials', (n) => { n.socials[i] = { ...n.socials[i], ...patch }; });
                return (
                  <div className={'social-row' + (showErr && m ? ' has-error' : '')} key={i} data-field={'socials.' + i}>
                    <label className="sr-only" htmlFor={'so-p-' + i}>Platform</label>
                    <select className="select" id={'so-p-' + i} value={known ? s.platform : 'Other'} onChange={(e) => setS({ platform: e.target.value })}>
                      {SOCIAL_PLATFORMS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                    <div>
                      <label className="sr-only" htmlFor={'so-u-' + i}>Profile URL</label>
                      <input className="input" type="url" id={'so-u-' + i} value={s.url} placeholder="https://" onChange={(e) => setS({ url: e.target.value })} />
                      {(!known || s.platform === 'Other') && (
                        <>
                          <label className="sr-only" htmlFor={'so-l-' + i}>Network name</label>
                          <input className="input" style={{ marginTop: 6 }} id={'so-l-' + i} value={known ? '' : s.platform} placeholder="Network name, e.g. Snapchat" onChange={(e) => setS({ platform: e.target.value || 'Other' })} />
                        </>
                      )}
                      {rowErr(m, !!m && (!!s.url || showErr))}
                    </div>
                    <button type="button" className="btn btn-ghost danger" aria-label={'Remove ' + s.platform + ' profile'} onClick={() => mutate('socials', (n) => n.socials.splice(i, 1))}>
                      <Icon name="trash3" />
                    </button>
                  </div>
                );
              })
            : emptyBox('', 'No social profiles added. Empty platforms are never shown on your page.')}
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => { mutate('socials', (n) => n.socials.push({ platform: 'Instagram', url: '' })); setTimeout(() => document.getElementById('so-p-' + socials.length)?.focus(), 30); }}>
          <Icon name="plus-lg" />
          Add social profile
        </button>
      </>
    );
  };

  const secReviews = () => {
    const rs = D.reviewSources || [], ac = D.achievements || [];
    return (
      <>
        <div className="info-note">
          <Icon name="shield-check" />
          <span>Reviews stay on the platforms where clients wrote them. Link your public review pages here — reviews, names and ratings can’t be typed in, and Emirate08 never generates them.</span>
        </div>
        <p className="sub-h">Manage review sources ({rs.length})</p>
        <div className="rep" data-field="reviewSources">
          {rs.length
            ? rs.map((x: any, i: number) => {
                const known = REVIEW_PLATFORMS.indexOf(x.platform) > -1 && x.platform !== 'Other';
                const err = reviewErr(x);
                const setR = (patch: any) => mutate('reviewSources', (n) => { n.reviewSources[i] = { ...n.reviewSources[i], ...patch }; });
                return (
                  <div className="rep-item" key={i} data-field={'reviewSources.' + i}>
                    <div className="rep-item__head">
                      <b>{x.platform || 'Review link'}</b>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {x.url && !err && (
                          <a className="btn btn-ghost btn-sm" href={x.url} target="_blank" rel="noopener">
                            Open<span className="sr-only"> {x.platform} page</span>
                          </a>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => mutate('reviewSources', (n) => n.reviewSources.splice(i, 1))}>
                          Remove link
                        </button>
                      </span>
                    </div>
                    <div className="rep-grid">
                      <div>
                        <label className="label" htmlFor={'rs-p-' + i}>Review platform</label>
                        <select className="select" id={'rs-p-' + i} value={known ? x.platform : 'Other'} onChange={(e) => setR({ platform: e.target.value })}>
                          {REVIEW_PLATFORMS.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                        {!known && (
                          <>
                            <label className="sr-only" htmlFor={'rs-l-' + i}>Platform name</label>
                            <input className="input" style={{ marginTop: 6 }} id={'rs-l-' + i} value={x.platform === 'Other' ? '' : x.platform} placeholder="Platform name" onChange={(e) => setR({ platform: e.target.value || 'Other' })} />
                          </>
                        )}
                      </div>
                      <div>
                        <label className="label" htmlFor={'rs-u-' + i}>Public review page URL</label>
                        <input className="input" type="url" id={'rs-u-' + i} value={x.url} placeholder="https://" onChange={(e) => setR({ url: e.target.value })} />
                      </div>
                    </div>
                    {rowErr(err, !!err && (!!x.url || showErr))}
                  </div>
                );
              })
            : emptyBox('link-45deg', 'No review links yet. Add your Google Reviews page or another trusted platform — the public Reviews tab shows a clean empty state until you do.')}
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => { mutate('reviewSources', (n) => n.reviewSources.push({ platform: 'Google Reviews', url: '' })); setTimeout(() => document.getElementById('rs-u-' + rs.length)?.focus(), 30); }}>
          <Icon name="plus-lg" />
          Add Review Link
        </button>
        <p className="sub-h">Achievements & case studies</p>
        <div className="rep">
          {ac.length
            ? ac.map((x: any, i: number) => {
                const setA = (patch: any) => mutate('achievements', (n) => { n.achievements[i] = { ...n.achievements[i], ...patch, approved: false }; });
                return (
                  <div className="rep-item" key={x.id || i}>
                    <div className="rep-item__head">
                      <b>{x.title || 'New achievement'}</b>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={'state-badge ' + (x.approved ? 'sb-verified' : 'sb-pending')}>{x.approved ? 'Approved' : 'Pending review'}</span>
                        <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => mutate('achievements', (n) => n.achievements.splice(i, 1))}>
                          Remove
                        </button>
                      </span>
                    </div>
                    <div className="rep-grid">
                      <div>
                        <label className="label" htmlFor={'ac-k-' + i}>Type</label>
                        <select className="select" id={'ac-k-' + i} value={x.kind} onChange={(e) => setA({ kind: e.target.value })}>
                          {ACHIEVEMENT_KINDS.map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      <div><label className="label" htmlFor={'ac-d-' + i}>Date</label><input className="input" type="month" id={'ac-d-' + i} value={x.date || ''} onChange={(e) => setA({ date: e.target.value })} /></div>
                      <div className="full"><label className="label" htmlFor={'ac-t-' + i}>Title</label><input className="input" id={'ac-t-' + i} value={x.title || ''} onChange={(e) => setA({ title: e.target.value })} /></div>
                      <div className="full">
                        <label className="label" htmlFor={'ac-x-' + i}>Details</label>
                        <p className="guide">Describe a genuine successful client experience — what the client needed and what you did.</p>
                        <textarea className="textarea" rows={2} id={'ac-x-' + i} value={x.detail || ''} onChange={(e) => setA({ detail: e.target.value })} />
                      </div>
                      <div className="full"><label className="label" htmlFor={'ac-e-' + i}>Supporting evidence</label><input className="input" id={'ac-e-' + i} value={x.evidence || ''} placeholder="e.g. certificate uploaded, client consent on file, link" onChange={(e) => setA({ evidence: e.target.value })} /></div>
                    </div>
                    <p className="hint">{x.approved ? 'Editing an approved item sends it back for review.' : 'Shown publicly once Emirate08 approves the supporting evidence.'}</p>
                  </div>
                );
              })
            : emptyBox('trophy', 'No achievements yet. Awards, certificates, notable transactions and case studies appear in your About tab once approved.')}
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => { mutate('achievements', (n) => n.achievements.push({ id: uid('ac'), kind: 'Case study', title: '', detail: '', date: '', evidence: '', approved: false })); setTimeout(() => document.getElementById('ac-t-' + ac.length)?.focus(), 30); }}>
          <Icon name="plus-lg" />
          Add achievement
        </button>
      </>
    );
  };

  /* listings: featured switches apply to listings immediately (same as before); order lives in the draft */
  const ownListings = data().listings;
  const placement = (l: any) => {
    if (l.status === 'published' && l.display.visible !== false) return 'active';
    if ((l.status === 'sold' || l.status === 'rented') && l.display.visible !== false) return 'completed';
    return 'hidden';
  };
  const toggleFeatured = (id: string) => {
    const l = getListing(id);
    l.display.portfolioFeatured = !l.display.portfolioFeatured;
    saveListing(l);
    commit({ ...clone(D), featuredOrder: featOrder(D.featuredOrder) });
  };
  const secPortfolio = () => {
    const order = ['published', 'pending', 'draft', 'unpublished', 'sold', 'rented', 'archived'];
    const mine = ownListings.slice().sort((a, c) => order.indexOf(a.status) - order.indexOf(c.status));
    const counts = { a: 0, c: 0, h: 0 };
    mine.forEach((l) => {
      const p = placement(l);
      counts[p === 'active' ? 'a' : p === 'completed' ? 'c' : 'h']++;
    });
    const feats = featuredListings();
    const fo = featOrder(D.featuredOrder);
    const move = (i: number, dir: number) => {
      const o = fo.slice();
      [o[i], o[i + dir]] = [o[i + dir], o[i]];
      commit({ ...clone(D), featuredOrder: o });
    };
    return (
      <>
        <div className="info-note">
          <Icon name="link-45deg" />
          <span>
            Listings come from <Link href="/listings">My Listings</Link> — the same inventory used by the listing editor. Draft, pending, unpublished and archived listings never appear publicly; sold and rented ones appear only under Sold.
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', justifyContent: 'space-between', margin: '16px 0 10px' }}>
          <p className="small">
            <b>{counts.a}</b> public · <b>{counts.c}</b> completed · <b>{counts.h}</b> not public
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label className="label" htmlFor="pf-sort">Default sorting</label>
              <select className="select" id="pf-sort" style={{ height: 38 }} value={D.defaultSort} onChange={(e) => set('defaultSort', e.target.value)}>
                <option value="featured">Featured first</option>
                <option value="newest">Newest</option>
                <option value="price-desc">Price: high to low</option>
                <option value="price-asc">Price: low to high</option>
              </select>
            </div>
            <Link className="btn btn-dark btn-sm" href="/listings/new" style={{ height: 38 }}>
              <Icon name="plus-lg" />
              Add property
            </Link>
          </div>
        </div>
        {mine.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <caption className="sr-only">Your listings</caption>
              <thead>
                <tr>
                  <th scope="col">Thumbnail</th>
                  <th scope="col">Property title</th>
                  <th scope="col">Location</th>
                  <th scope="col">Status</th>
                  <th scope="col">Public visibility</th>
                  <th scope="col">Featured</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((l) => {
                  const isPub = l.status === 'published';
                  const on = !!l.display.portfolioFeatured;
                  const p = placement(l);
                  return (
                    <tr key={l.id}>
                      <td>{photoOf(l) ? <img className="thumb" src={photoOf(l)} alt="" loading="lazy" /> : <span className="thumb" style={{ background: 'var(--mist)' }} aria-hidden="true" />}</td>
                      <td>
                        <div className="t-title">{l.title || 'Untitled'}</div>
                        <div className="t-sub">
                          {l.ref || l.id}
                          {l.price ? ' · AED ' + Number(l.price).toLocaleString('en-US') + (l.purpose === 'rent' ? '/yr' : '') : ''}
                        </div>
                      </td>
                      <td>{l.area || ''}</td>
                      <td><span className={'state-badge sb-' + (l.status === 'pending' ? 'pending-review' : l.status)}>{ST_LABEL[l.status] || l.status}</span></td>
                      <td>
                        {p === 'active' ? <span className="vis-ok">Shown in Property Listings</span> : p === 'completed' ? (D.showClosed !== false ? <span className="vis-ok">Shown in Sold</span> : <span className="vis-off">Hidden (history off)</span>) : <span className="vis-off">Not public</span>}
                      </td>
                      <td>
                        <button type="button" className="star-btn" aria-pressed={on} disabled={!isPub} aria-label={(on ? 'Unfeature ' : 'Feature ') + (l.title || 'listing')} title={isPub ? (on ? 'Unfeature' : 'Feature') : 'Only published listings can be featured'} onClick={() => toggleFeatured(l.id)}>
                          <Icon name={on ? 'star-fill' : 'star'} />
                        </button>
                      </td>
                      <td>
                        <div className="act-links">
                          {isPub && (
                            <Link href={listingUrl(l)} target="_blank" rel="noopener">
                              View<span className="sr-only"> {l.title}</span>
                            </Link>
                          )}
                          <Link href={routes.editListing(l.id)}>
                            Edit<span className="sr-only"> {l.title} in the listing editor</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          emptyBox('buildings', <>No listings yet. <Link className="link" href="/listings/new">Create your first listing</Link> — it will appear here automatically.</>)
        )}
        <p className="sub-h">Featured order</p>
        {fo.length ? (
          <ol className="feat-order">
            {fo.map((id, i) => {
              const l = feats.find((x) => x.id === id);
              if (!l) return null;
              return (
                <li key={id}>
                  {photoOf(l) ? <img src={photoOf(l)} alt="" /> : <span />}
                  <span>{l.title}</span>
                  <span className="mv">
                    <button type="button" disabled={i === 0} aria-label={'Move ' + l.title + ' up'} onClick={() => move(i, -1)}>
                      <Icon name="arrow-up" />
                    </button>
                    <button type="button" disabled={i === fo.length - 1} aria-label={'Move ' + l.title + ' down'} onClick={() => move(i, 1)}>
                      <Icon name="arrow-down" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          emptyBox('', 'No featured listings. Use the star in the table to feature published listings.')
        )}
        <p className="info-note" style={{ marginTop: 14 }}>
          <Icon name="clock-history" />
          <span>
            Sold & rented history is <b>{D.showClosed !== false ? 'shown' : 'hidden'}</b> on your public profile.{' '}
            <button type="button" className="linkish" onClick={() => goto('visibility')}>
              Change in Visibility & Optimization
            </button>
          </span>
        </p>
      </>
    );
  };

  const active = ownListings.filter((l) => placement(l) === 'active');
  const done = D.showClosed !== false ? ownListings.filter((l) => placement(l) === 'completed') : [];
  const groups = readiness(D, { active, done, verified, published: true, fieldStatus: fs });

  const secVisibility = () => {
    const when = published.publishedAt || published.updatedAt;
    const si = slugIssue(D.slug || '');
    const sw = (key: string, title: string, desc: string, dis = false, checked = D[key] !== false) => (
      <div className="switch">
        <div>
          <b id={'sw-' + key}>{title}</b>
          <p>{desc}</p>
        </div>
        <input
          type="checkbox"
          checked={checked}
          disabled={dis}
          aria-labelledby={'sw-' + key}
          onChange={(e) => {
            const v = e.target.checked;
            if (key === 'isPublic' && !v) commit({ ...D, isPublic: false, searchable: false, indexable: false });
            else set(key, v);
          }}
        />
      </div>
    );
    return (
      <>
        <p className="sub-h">Publication status</p>
        <div className="pub-grid">
          <div>Published version<b>{when ? new Date(when).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never published'}</b></div>
          <div>Draft<b>{dirty ? 'Has unpublished changes' : 'Matches published version'}</b></div>
          <div>Search engines<b>{published.isPublic !== false && published.indexable !== false ? 'Indexable' : 'Not indexed (noindex)'}</b></div>
          <div>Find an Agent<b>{published.isPublic !== false && published.searchable !== false ? 'Listed' : 'Not listed'}</b></div>
        </div>
        <p className="sub-h">Public profile URL</p>
        <div className={'field' + (errAt('slug') ? ' has-error' : '')} data-field="slug">
          <label className="label" htmlFor="slug-in">Profile address</label>
          <div className="slug">
            <span>emirate8.com/brokers/</span>
            <input id="slug-in" value={D.slug || ''} spellCheck={false} autoCapitalize="off" aria-describedby="slug-state" aria-invalid={si ? true : undefined} onChange={(e) => set('slug', e.target.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
          </div>
          <p className={'slug-state ' + (si ? 'bad' : 'ok')} id="slug-state" aria-live="polite">
            <Icon name={si ? 'x-circle' : 'check-circle'} />
            {si || (published.slug === D.slug ? 'Current address' : 'Available') + ' — emirate8.com/brokers/' + D.slug}
          </p>
          <div className="media-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={copyProfile}>
              <Icon name="copy" />
              Copy URL
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={viewPublic}>
              <Icon name="box-arrow-up-right" />
              Open public page
            </button>
          </div>
          <p className="hint">Lowercase letters, numbers and hyphens. Once published, your profile opens at the new address — share the new link afterwards.</p>
        </div>
        <p className="sub-h">Visibility settings</p>
        <div>
          {sw('isPublic', 'Public profile', 'When off, the page shows “profile unavailable” to visitors and is excluded from search engines.')}
          {sw('searchable', 'Show in Find an Agent', 'Lists you in the Emirate08 directory. Turning this off does not make your page private — it stays reachable by its link.', D.isPublic === false)}
          {sw('indexable', 'Allow search engine indexing', 'Separate from the directory: controls whether search engines may index this page.', D.isPublic === false)}
          {sw('showClosed', 'Show sold & rented history', 'Shows completed transactions in the Sold tab. Turn off to hide the tab entirely.')}
          {sw('showSocials', 'Show social links', 'Shows the social profiles you added in Contact & Social Links.')}
          <div className="switch">
            <div>
              <b><label htmlFor="vis-contact">Contact visibility</label></b>
              <p>Choose whether phone, WhatsApp and email appear, or only the enquiry form.</p>
            </div>
            <select className="select" id="vis-contact" style={{ width: 'auto', height: 38 }} value={D.contactMode} onChange={(e) => set('contactMode', e.target.value)}>
              <option value="all">Show all contact options</option>
              <option value="form">Enquiry form only</option>
            </select>
          </div>
        </div>
        <p className="sub-h" id="readiness">
          Profile readiness <span className="demo-flag" style={{ textTransform: 'none', letterSpacing: 0 }}>Checklists — not rankings</span>
        </p>
        <div className="ready-grid">
          {(['seo', 'ai', 'cro', 'trust'] as const).map((k) => {
            const x = groups[k];
            const open = readyOpen[k];
            return (
              <div className="ready-card" key={k}>
                <button type="button" aria-expanded={open} aria-controls={'rc-' + k} onClick={() => setReadyOpen({ ...readyOpen, [k]: !open })}>
                  <h4>
                    {x.title}
                    <span>{x.passed} of {x.total} checks</span>
                  </h4>
                  <div className={'meter' + (k === 'ai' ? ' meter--ai' : '')}>
                    <i style={{ width: x.pct + '%' }} />
                  </div>
                </button>
                <ul id={'rc-' + k} hidden={!open}>
                  {x.items.map((it) => (
                    <li key={it.label}>
                      <Icon name={it.pass ? 'check-circle-fill' : 'circle'} />
                      <span>
                        <span className="sr-only">{it.pass ? 'Done: ' : 'To do: '}</span>
                        {it.label}
                        {!it.pass && it.hint && (
                          <small>
                            {it.hint}{' '}
                            <button type="button" className="linkish" style={{ fontSize: 11.5, textDecoration: 'underline' }} onClick={() => goto(it.section)}>
                              Fix
                            </button>
                          </small>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="xs muted" style={{ marginTop: 10 }}>
          These checks show whether your page contains complete, consistent information. They are not Google rankings, AI recommendation probabilities, or a guarantee of visibility.
        </p>
      </>
    );
  };
  const RENDER: Record<string, () => ReactNode> = { identity: secIdentity, about: secAbout, areas: secAreas, credentials: secCredentials, contact: secContact, reviews: secReviews, portfolio: secPortfolio, visibility: secVisibility };

  /* ---------------- shell ---------------- */
  const idx = SECTIONS.findIndex(([k]) => k === current);
  const sec = SECTIONS[idx] || SECTIONS[0];
  const counts = (s: string) => {
    const c = { ai: 0, warn: 0, err: errors.filter((e) => e.section === s).length };
    Object.entries(fs).forEach(([p, v]) => {
      if (sectionOf(p) !== s) return;
      if (v === 'filled') c.ai++;
      if (v === 'missing' || v === 'verify' || v === 'error') c.warn++;
    });
    return c;
  };
  /** A section counts as complete when what buyers rely on is in place (not every optional field). */
  const secDone: Record<string, boolean> = {
    identity: !empty(D.displayName) && !empty(D.title) && !empty(D.headline) && !empty(D.intro) && !!D.photo,
    about: !empty(D.bio) && (D.specialties || []).length > 0,
    areas: (D.areas || []).length > 0,
    credentials: verified,
    contact: !empty(D.publicEmail) || !empty(D.publicPhone),
    reviews: (D.reviewSources || []).length > 0,
    portfolio: active.length > 0,
    visibility: !slugIssue(D.slug || '') && D.isPublic !== false,
  };
  const doneCount = Object.values(secDone).filter(Boolean).length;
  const n = { ai: 0, edited: 0, missing: 0, verify: 0, error: 0 } as Record<string, number>;
  Object.values(fs).forEach((v) => (n[v] = (n[v] || 0) + 1));
  const showAiNotice = !!(n.filled || n.verify || n.missing || n.error);
  const review = Object.values(fs).some((v) => v === 'verify' || v === 'missing' || v === 'filled');
  const pill = published.isPublic === false ? ['unpublished', 'Unpublished'] : review ? ['review', 'Needs Review'] : ['published', 'Published'];
  const liveWhen = published.publishedAt || published.updatedAt;

  const barState = hasErrors ? 'errors' : bar;
  const preview_b = preview ? { ...brokerFromUser({ ...currentUser(), portfolio: D }), isPublic: true } : null;

  return (
    <div className="e8p e8p--builder">
      <div className="container">
        <div className="dash-head">
          <div>
            <p className="eyebrow">Your professional presence</p>
            <div className="dash-head__meta" style={{ marginTop: 4 }}>
              <h1>Build Your Professional Portfolio</h1>
              <span className={'status-pill status-pill--' + pill[0]}>{pill[1]}</span>
            </div>
            <p className="lead">Create a professional online presence that showcases your expertise, properties, and achievements. Help potential buyers discover, evaluate, and contact you—all from one place.</p>
            <p className="xs muted" style={{ marginTop: 6 }}>
              {dirty ? 'Live version published ' + (liveWhen ? new Date(liveWhen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '') + ' · unpublished changes in draft' : 'Live version matches your draft'}
            </p>
          </div>
        </div>

        {/* AI: the app's real autofill (documents + website), placed where the reference puts its AI section */}
        <div style={{ marginTop: 20 }}>
          <AiAutofill
            id="profile-ai"
            context="broker-profile"
            defaultOpen={typeof window !== 'undefined' && location.hash === '#autofill'}
            current={D}
            onApply={applyAutofill}
            onReview={reviewForm}
            onUndo={snapshot ? undoAI : undefined}
            onManual={() => {
              goto('identity');
              setTimeout(() => document.getElementById('f-displayName')?.focus(), 40);
            }}
          />
        </div>

        <div className="editor" id="editor" ref={editorRef}>
          <nav className="editor-nav" aria-label="Profile sections">
            {SECTIONS.map(([k, label], i) => {
              const c = counts(k);
              return (
                <button key={k} type="button" className="editor-nav__btn" aria-current={k === current ? 'true' : undefined} onClick={() => goto(k)}>
                  <span className="editor-nav__num">{i + 1}</span>
                  {label}
                  <span className="editor-nav__state">
                    {!!c.err && <span className="warn" title={c.err + ' to fix'}><Icon name="exclamation-octagon-fill" />{c.err}<span className="sr-only"> errors</span></span>}
                    {!!c.warn && <span className="warn" title="Needs attention"><Icon name="exclamation-circle" />{c.warn}<span className="sr-only"> need attention</span></span>}
                    {!!c.ai && <span className="ai" title="AI generated"><Icon name="stars" />{c.ai}<span className="sr-only"> AI generated</span></span>}
                  </span>
                </button>
              );
            })}
            <button type="button" className="ready-mini" onClick={() => goto('visibility', false, 'readiness')}>
              <b>Profile readiness</b>
              {(['seo', 'ai', 'cro', 'trust'] as const).map((k) => (
                <span className="ready-mini__row" key={k}>
                  <span>{groups[k].title.replace(' Readiness', '').replace('AI Information', 'AI information')}</span>
                  <span className={'meter' + (k === 'ai' ? ' meter--ai' : '')}>
                    <i style={{ width: groups[k].pct + '%' }} />
                  </span>
                </span>
              ))}
            </button>
          </nav>

          <div ref={secRef}>
            <div className="sec-card ai-scope" data-ai-state="manual">
              <div className="sec-hero" key={sec[0]}>
                <div className="sec-hero__row">
                  <span className={'sec-hero__icon' + (secDone[sec[0]] ? ' is-done' : '')} aria-hidden="true">
                    <Icon name={secDone[sec[0]] ? 'check-lg' : SECTION_ICON[sec[0]]} />
                  </span>
                  <div className="sec-hero__txt">
                    <p className="sec-hero__meta">
                      <span className="sec-hero__step">Step {idx + 1} of {SECTIONS.length}</span>
                      {(() => {
                        const c = counts(sec[0]);
                        const [cls, icon, label] = c.err
                          ? ['err', 'exclamation-octagon-fill', c.err + ' to fix']
                          : c.warn
                            ? ['warn', 'exclamation-triangle-fill', 'Needs your input']
                            : secDone[sec[0]]
                              ? ['ok', 'check-circle-fill', 'Complete']
                              : ['idle', 'circle-half', 'In progress'];
                        return (
                          <>
                            <span className={'sec-chip sec-chip--' + cls}>
                              <Icon name={icon} />
                              {label}
                            </span>
                            {!!c.ai && (
                              <span className="sec-chip sec-chip--ai">
                                <Icon name="stars" />
                                {c.ai} AI-filled
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </p>
                    <h2 id="sec-title" tabIndex={-1}>{sec[1]}</h2>
                    <p className="sec-hero__desc">{sec[2]}</p>
                  </div>
                  <div className="sec-hero__side">
                    <b>
                      {doneCount}
                      <small>/{SECTIONS.length}</small>
                    </b>
                    <span>sections complete</span>
                  </div>
                </div>
              </div>
              {showAiNotice && (
                <div className="ai-notice" style={{ margin: '18px 26px 0' }}>
                  <Icon name="stars" />
                  <div>
                    <b>Fields were filled from your resources. Please review them before publishing.</b>
                    <div className="ai-notice__meta">
                      <span><Icon name="stars" className="text-[#4f46e5]" />{n.filled || 0} AI-Filled</span>
                      <span><Icon name="pencil" />{n.edited || 0} edited</span>
                      <span><Icon name="exclamation-triangle-fill" className="text-[#a16207]" />{(n.missing || 0) + (n.verify || 0)} need your input</span>
                      <span><Icon name="x-octagon-fill" className="text-[#dc2626]" />{n.error || 0} error</span>
                    </div>
                  </div>
                  <div className="ai-notice__actions">
                    {snapshot && (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={undoAI}>
                        <Icon name="arrow-counterclockwise" />
                        Undo autofill
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="sec-card__body">{RENDER[sec[0]]()}</div>
              <div className="sec-card__foot">
                {idx > 0 ? (
                  <button type="button" className="btn btn-ghost" onClick={() => goto(SECTIONS[idx - 1][0])}>
                    <Icon name="arrow-left" />
                    {SECTIONS[idx - 1][1]}
                  </button>
                ) : (
                  <span />
                )}
                {idx < SECTIONS.length - 1 ? (
                  <button type="button" className="btn btn-outline" onClick={() => goto(SECTIONS[idx + 1][0])}>
                    {SECTIONS[idx + 1][1]}
                    <Icon name="arrow-right" />
                  </button>
                ) : (
                  <button type="button" className="btn btn-dark" onClick={publish}>
                    Publish changes
                    <Icon name="send" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* sticky action bar */}
      <div className={'actionbar' + (more ? ' is-open' : '')} role="region" aria-label="Profile actions">
        <div className="actionbar__in" style={{ position: 'relative' }}>
          <div className="actionbar__state" data-s={barState} aria-live="polite">
            {barState === 'errors' ? (
              <>
                <Icon name="exclamation-octagon-fill" />
                <div>
                  <b style={{ color: 'var(--danger)' }}>Validation errors — fix {errors.length} item{errors.length > 1 ? 's' : ''} to publish</b>
                  <ul className="errlist">
                    {errors.slice(0, 4).map((e, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => focusErr(e)}>{e.label}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : barState === 'publishing' ? (
              <>
                <Icon name="arrow-repeat" />
                <b>Publishing…</b>
              </>
            ) : barState === 'unsaved' ? (
              <>
                <Icon name="circle-fill" className="text-[9px]" />
                <span><b>Unsaved changes</b> · saving draft…</span>
              </>
            ) : barState === 'published' && !dirty ? (
              <>
                <Icon name="check-circle-fill" />
                <span><b>Published</b> · your public profile is up to date</span>
              </>
            ) : (
              <>
                <Icon name="cloud-check" />
                <span>
                  <b>All changes saved</b>
                  {dirty ? ' to draft · not yet published' : ' · matches your public profile'}
                  {savedAt && <span className="xs muted"> ({savedAt})</span>}
                </span>
              </>
            )}
          </div>
          <div className="actionbar__btns">
            <button type="button" className="btn btn-outline" data-act="preview" onClick={() => setPreview('desktop')}>
              <Icon name="eye" />
              Quick Preview
            </button>
            <button type="button" className="btn btn-ghost" data-act="view" onClick={viewPublic}>
              <Icon name="box-arrow-up-right" />
              View Public Profile
            </button>
            <button type="button" className="btn btn-ghost danger" data-act="discard" disabled={!dirty || barState === 'publishing'} onClick={discard}>
              Discard Changes
            </button>
            <button type="button" className="btn btn-dark" data-act="publish" disabled={barState === 'publishing'} onClick={publish}>
              <Icon name="send" />
              Publish Changes
            </button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm actionbar__more" aria-expanded={more} aria-label="More actions" onClick={() => setMore(!more)}>
            <Icon name="three-dots" />
          </button>
        </div>
      </div>

      {/* Quick Preview: the unsaved draft, rendered with the same public renderer */}
      {preview && preview_b && (
        <div className={'pv' + (preview === 'mobile' ? ' pv--mobile' : '')} role="dialog" aria-modal="true" aria-labelledby="pv-h" onKeyDown={(e) => e.key === 'Escape' && setPreview('')}>
          <div className="pv__bar">
            <div>
              <h2 id="pv-h">Portfolio Preview</h2>
              <p>See how your professional portfolio will appear to visitors.</p>
            </div>
            <div className="pv__seg" role="group" aria-label="Preview device">
              <button type="button" aria-pressed={preview === 'desktop'} onClick={() => setPreview('desktop')} autoFocus>
                <Icon name="display" />
                Desktop
              </button>
              <button type="button" aria-pressed={preview === 'mobile'} onClick={() => setPreview('mobile')}>
                <Icon name="phone" />
                Mobile
              </button>
            </div>
            <button type="button" className="pp-icon" aria-label="Close preview" onClick={() => setPreview('')}>
              <Icon name="x-lg" />
            </button>
          </div>
          <div className="pv__stage">
            <div className="pv__frame">
              <div className="pv__scroll">
                <BrokerPublicProfile preview b={preview_b} listings={ownListings} notices={['Preview of your unsaved draft. Changes are not public until you publish.']} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI conflicts: nothing is replaced unless the broker chooses it */}
      {conflicts && (
        <div className="dlg">
          <div className="dlg__scrim" />
          <div className="dlg__box" role="dialog" aria-modal="true" aria-labelledby="dlg-h">
            <div className="dlg__head">
              <div>
                <h2 id="dlg-h">Keep your existing details?</h2>
                <p>
                  Your sources contain different values for {conflicts.list.length} field{conflicts.list.length > 1 ? 's' : ''} you already filled in. Nothing is replaced unless you choose it.
                </p>
              </div>
            </div>
            <div className="dlg__body">
              {conflicts.list.map((c, k) => (
                <fieldset className="conf-row" key={c.path}>
                  <legend className="label">{LABELS[c.path] || c.path}</legend>
                  <div className="cur"><span className="xs muted">Yours</span><br />{String(c.cur)}</div>
                  <div className="new"><span className="xs muted">From your sources</span><br />{String(c.val)}</div>
                  <div className="opts">
                    <label className="check">
                      <input type="radio" name={'cf-' + k} checked={conflicts.choice[k] !== 'ai'} onChange={() => setConflicts({ ...conflicts, choice: { ...conflicts.choice, [k]: 'keep' } })} />
                      Keep mine
                    </label>
                    <label className="check">
                      <input type="radio" name={'cf-' + k} checked={conflicts.choice[k] === 'ai'} onChange={() => setConflicts({ ...conflicts, choice: { ...conflicts.choice, [k]: 'ai' } })} />
                      Use the value from my sources
                    </label>
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="dlg__foot">
              <button type="button" className="btn btn-dark" onClick={resolveConflicts} autoFocus>
                Apply choices
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
