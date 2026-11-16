'use client';

import { Fragment, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useSession } from '@/components/providers/SessionProvider';
import { useHydrated, useStoreVersion } from '@/hooks/useStore';
import { addEnquiry, agencies, brokerUrl, isSaved, listingUrl, photoOf, toggleSaved } from '@/lib/store';
import { absUrl, copyText } from '@/lib/share';
import { digits } from '@/lib/utils';
import {
  DEFAULT_BROKER_COVER,
  PREFERRED_LABEL,
  areaRows,
  compactAed,
  faqItems,
  monthLabel,
  normSort,
  safeUrl,
} from '@/lib/brokerProfile';
import './profiles.css';

/* Public broker profile — React port of UI_Changes/emirate8-page-updates/single-broker-public-profile.html
 * (renderer: js/public-profiles.js). Same markup and class names; styles come from ./profiles.css.
 * Rendered inside the marketplace header/footer, and inside the dashboard's Quick Preview (`preview`). */

const SOCIAL_ICON: Record<string, string> = { Instagram: 'instagram', Facebook: 'facebook', LinkedIn: 'linkedin', TikTok: 'tiktok', YouTube: 'youtube', X: 'twitter-x', Threads: 'threads' };
const REVIEW_ICON: Record<string, string> = { 'Google Reviews': 'google', 'Facebook Reviews': 'facebook', Trustpilot: 'star', 'Property Finder': 'house-door', Bayut: 'buildings' };
const STEPS: [string, string][] = [
  ['Understand Your Requirements', 'Budget, timeline, financing and how you will use the property.'],
  ['Find & Evaluate Properties', 'A short list with prices, service charges and comparable sales.'],
  ['Arrange Viewings', 'In person or by video call, grouped to save you time.'],
  ['Guide You Through the Transaction', 'Offer, MoU, mortgage valuation, NOC and transfer at the trustee office.'],
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const aed = (n: number) => 'AED ' + Number(n || 0).toLocaleString('en-US');
const initials = (n: string) => String(n || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const paras = (t?: string) => (t ? String(t).split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>) : null);
const uniq = <T,>(a: T[]) => a.filter((x, i) => x && a.indexOf(x) === i);
const isActive = (l: any) => l.status === 'published' && l.display?.visible !== false;
const isDone = (l: any) => (l.status === 'sold' || l.status === 'rented') && l.display?.visible !== false;
function shortDesc(l: any) {
  const prose = String(l.shortDesc || l.description || '').replace(/\s+/g, ' ').trim();
  if (!prose) return '';
  const first = prose.split(/(?<=[.!?])\s+/)[0] || prose;
  return first.length <= 140 ? first : first.slice(0, 137).replace(/\s+\S*$/, '') + '…';
}

type Props = {
  b: any;
  listings: any[];
  /** Rendered inside the dashboard Quick Preview: enquiries are not sent, links open in a new tab. */
  preview?: boolean;
  /** Owner / preview notices shown above the header card. */
  notices?: string[];
  noticeAction?: ReactNode;
};

export function BrokerPublicProfile({ b, listings, preview = false, notices = [], noticeAction }: Props) {
  const { toast } = useFeedback();
  const { user } = useSession();
  useStoreVersion();
  const hydrated = useHydrated();
  const name: string = b.name;
  const first = name.split(' ')[0];
  const contactAll = b.contactMode !== 'form';
  const wa = contactAll && digits(b.whatsapp) ? `https://wa.me/${digits(b.whatsapp)}?text=${encodeURIComponent(`Hello ${name}, I found your profile on Emirate08.`)}` : '';
  const phone = contactAll ? b.phone : '';
  const path = brokerUrl(b);
  const url = hydrated ? absUrl(path) : path;

  /* current agency = platform relationship only */
  const agencyRec = b.currentAgency ? agencies().find((a: any) => String(a.id) === String(b.currentAgency.id)) : null;
  const agency = b.currentAgency
    ? { name: b.currentAgency.name, href: '/agencies/' + encodeURIComponent(agencyRec?.id ?? b.currentAgency.id), logo: agencyRec?.photo || '' }
    : null;

  const active = listings.filter(isActive);
  const showSold = b.showClosed !== false;
  const doneAll = listings.filter(isDone);
  const completed = showSold ? doneAll : [];
  const sold = doneAll.filter((l) => l.status === 'sold');
  const rented = doneAll.filter((l) => l.status === 'rented');
  const perf = {
    active: active.length,
    sale: active.filter((l) => l.purpose === 'sale').length,
    rent: active.filter((l) => l.purpose === 'rent').length,
    offplan: active.filter((l) => l.completion === 'offplan').length,
    sales: sold.length,
    rentals: rented.length,
    saleValue: sold.reduce((s, l) => s + (+l.price || 0), 0),
    rentValue: rented.reduce((s, l) => s + (+l.price || 0), 0),
  };
  const areas = areaRows(b.areas || [], b.areaMeta || {});
  const socials: any[] = (b.socials || []).filter((s: any) => safeUrl(s.url));
  const reviewSources: any[] = (b.reviewSources || []).filter((x: any) => safeUrl(x.url));
  const designation = b.title || (agency ? 'Real Estate Broker' : 'Independent Real Estate Broker');

  /* ---------------- tabs ---------------- */
  const tabs: [string, string, number | null][] = [['listings', 'Property Listings', active.length], ['about', 'About', null], ['reviews', 'Reviews', reviewSources.length]];
  if (showSold) tabs.push(['sold', 'Sold', completed.length]);
  /* #about / #reviews / #sold deep links open that tab (read after hydration, so SSR stays on Listings) */
  const [picked, setTab] = useState<string | null>(null);
  const hashTab = hydrated && !preview ? (location.hash || '').replace('#', '') : '';
  const tab = picked ?? (tabs.some(([k]) => k === hashTab) ? hashTab : 'listings');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tablist = useRef<HTMLDivElement>(null);
  const selectTab = (t: string, focus = false) => {
    setTab(t);
    if (focus) setTimeout(() => tabRefs.current[t]?.focus(), 0);
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const n = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (n == null) return;
    e.preventDefault();
    selectTab(tabs[n][0], true);
  };
  const gotoTab = (t: string) => {
    selectTab(t, true);
    tablist.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  /* ---------------- listing filters ---------------- */
  const defaultSort = normSort(b.defaultSort);
  const F0 = { purpose: 'all', completion: 'all', ptype: 'all', area: 'all', price: 'any', beds: 'any', sort: defaultSort };
  const [f, setF] = useState(F0);
  const types = uniq(active.map((l) => l.type)).sort();
  const locs = uniq(active.map((l) => l.area)).sort();
  const order: string[] = b.featuredOrder || [];
  const rank = (l: any) => {
    const i = order.indexOf(l.id);
    return i > -1 ? i : l.display?.portfolioFeatured ? 500 : 999;
  };
  const newer = (a: any, c: any) => String(c.createdAt || '').localeCompare(String(a.createdAt || '')) || (a.listed || 0) - (c.listed || 0);
  const sortL = (arr: any[], s: string) =>
    arr.slice().sort((a, c) => {
      if (s === 'price-desc') return (c.price || 0) - (a.price || 0);
      if (s === 'price-asc') return (a.price || 0) - (c.price || 0);
      if (s === 'newest') return newer(a, c);
      return rank(a) - rank(c) || newer(a, c);
    });
  const pr = f.price !== 'any' ? f.price.split('-') : null;
  const results = sortL(
    active.filter((l) => {
      if (f.purpose !== 'all' && l.purpose !== f.purpose) return false;
      if (f.completion !== 'all' && (l.completion || 'ready') !== f.completion) return false;
      if (f.ptype !== 'all' && l.type !== f.ptype) return false;
      if (f.area !== 'all' && l.area !== f.area) return false;
      if (pr && ((l.price || 0) < +pr[0] || (pr[1] && (l.price || 0) > +pr[1]))) return false;
      if (f.beds !== 'any' && (f.beds === '0' ? +l.beds !== 0 : +l.beds < +f.beds)) return false;
      return true;
    }),
    f.sort,
  );
  const showing = (n: number, total: number) =>
    !n ? 'No properties match these filters' : 'Showing 1–' + n + ' of ' + n + (n === 1 ? ' property' : ' properties') + (n < total ? ' · ' + total + ' in total' : '');

  /* sold filters */
  const [sf, setSf] = useState({ kind: 'all', ptype: 'all', area: 'all' });
  const soldOut = completed
    .filter((l) => (sf.kind === 'all' || l.status === sf.kind) && (sf.ptype === 'all' || l.type === sf.ptype) && (sf.area === 'all' || l.area === sf.area))
    .sort((a, c) => String(c.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  /* ---------------- favourites ---------------- */
  const fav = (l: any) => {
    if (preview) return;
    if (!user) {
      toast(
        <>
          Sign in to save properties.{' '}
          <Link className="underline" href="/login">
            Sign in
          </Link>
        </>,
        { icon: 'heart' },
      );
      return;
    }
    const now = toggleSaved(l.id);
    toast(now ? 'Saved to your favourites.' : 'Removed from saved properties.', { icon: now ? 'heart-fill' : 'heart' });
  };

  /* ---------------- FAQ ---------------- */
  const [openFaq, setOpenFaq] = useState<number[]>([]);
  const faq = faqItems({ areas, languages: b.languages || [], clients: b.clients || [], specialties: b.specialties || [], approach: b.approach || '', preferred: b.preferred, booking: b.booking || '', active });

  /* ---------------- share ---------------- */
  const [copied, setCopied] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const shareCard = useRef<HTMLElement>(null);
  const shareInput = useRef<HTMLInputElement>(null);
  const copyUrl = (isShare: boolean) => {
    if (isShare && !preview && navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: name + ' on Emirate08', url }).catch(() => {});
      return;
    }
    const done = () => {
      setCopyStatus('Link copied: ' + url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (isShare) shareCard.current?.scrollIntoView({ block: 'nearest' });
    };
    copyText(url).then(done, () => {
      shareInput.current?.focus();
      shareInput.current?.select();
      done();
    });
  };

  /* ---------------- contact modal ---------------- */
  const [modal, setModal] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const modalBox = useRef<HTMLDivElement>(null);
  const blank = { name: '', email: '', phone: '', message: '' };
  const [form, setForm] = useState(blank);
  const [ferr, setFerr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<'' | 'sent' | 'preview'>('');
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const openContact = (e?: React.MouseEvent) => {
    lastFocus.current = (e?.currentTarget as HTMLElement) || (document.activeElement as HTMLElement);
    setSent('');
    setSendErr('');
    setModal(true);
    setTimeout(() => modalBox.current?.querySelector<HTMLElement>('input,textarea,button')?.focus(), 20);
  };
  const closeContact = () => {
    setModal(false);
    lastFocus.current?.focus?.();
  };
  const fieldErr = (k: string, v: string) => {
    v = v.trim();
    if (k === 'name') return v ? '' : 'Enter your name.';
    if (k === 'email') return !v ? 'Enter your email address.' : !EMAIL.test(v) ? 'Enter an email address like name@example.com.' : '';
    if (k === 'phone') return !v ? 'Enter your phone number.' : !/^\+?[\d\s()-]{7,20}$/.test(v) ? 'Enter a valid phone number, like +971 50 123 4567.' : '';
    if (k === 'message') return v.length < 10 ? 'Add a short message (at least 10 characters).' : '';
    return '';
  };
  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm((s) => ({ ...s, [k]: v }));
    if (ferr[k]) setFerr((s) => ({ ...s, [k]: fieldErr(k, v) }));
  };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    for (const k of Object.keys(blank)) {
      const m = fieldErr(k, (form as Record<string, string>)[k]);
      if (m) er[k] = m;
    }
    setFerr(er);
    const firstBad = Object.keys(er)[0];
    if (firstBad) {
      e.currentTarget.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }
    if (preview) {
      setSent('preview');
      return;
    }
    setSending(true);
    setSendErr('');
    try {
      await addEnquiry({
        kind: 'message',
        brokerId: b.id,
        brokerName: name,
        propertyId: '',
        propertyTitle: 'General enquiry',
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        preferredDate: '',
        message: form.message.trim(),
      });
      setSent('sent');
      setForm(blank);
    } catch (error) {
      setSendErr(error instanceof Error ? error.message : 'Could not send the enquiry.');
    } finally {
      setSending(false);
    }
  };
  const onModalKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeContact();
    }
    if (e.key === 'Tab' && modalBox.current) {
      const els = Array.from(modalBox.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea')).filter((x) => x.offsetParent !== null);
      if (!els.length) return;
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault();
        els[els.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === els[els.length - 1]) {
        e.preventDefault();
        els[0].focus();
      }
    }
  };

  /** In the preview, links open in a new tab so the dashboard stays put. */
  const ext = preview ? { target: '_blank', rel: 'noopener' } : {};

  /* ---------------- property card (shared by Listings and Sold) ---------------- */
  const card = (l: any) => {
    const done = l.status === 'sold' || l.status === 'rented';
    const rent = l.purpose === 'rent';
    const href = listingUrl(l);
    const t = l.title || 'Property';
    const saved = hydrated && !preview && isSaved(l.id);
    const commercial = l.category === 'commercial' || /office|retail|warehouse|shop/i.test(l.type || '');
    const specs: [string, string][] = [];
    if (!commercial && l.beds !== '' && l.beds != null) specs.push(['door-closed', +l.beds === 0 ? 'Studio' : l.beds + (+l.beds === 1 ? ' bed' : ' beds')]);
    if (l.baths !== '' && l.baths != null) specs.push(['droplet', l.baths + (+l.baths === 1 ? ' bath' : ' baths')]);
    if (l.size) specs.push(['bounding-box', Number(l.size).toLocaleString('en-US') + ' sq ft']);
    const loc = (l.community && l.community !== l.area ? l.community + ', ' : '') + (l.area || '');
    const desc = done ? '' : shortDesc(l);
    return (
      <article key={l.id} className={'pp-pcard' + (done ? ' pp-pcard--done' : '')} aria-labelledby={'t-' + l.id}>
        <div className="pp-pcard__media">
          {photoOf(l) ? <img src={photoOf(l)} alt={t} width={800} height={600} loading="lazy" decoding="async" /> : null}
          <div className="pp-card__badges">
            {done ? (
              <span className="pp-badge pp-badge--dark">{l.status === 'sold' ? 'Sold' : 'Rented'}</span>
            ) : (
              <>
                <span className="pp-badge pp-badge--dark">{rent ? 'For rent' : 'For sale'}</span>
                <span className="pp-badge pp-badge--light">{l.completion === 'offplan' ? 'Off-plan' : 'Ready'}</span>
              </>
            )}
          </div>
          <button type="button" className="pp-fav" aria-pressed={saved} aria-label={(saved ? 'Remove ' : 'Save ') + t + (saved ? ' from favourites' : ' to favourites')} onClick={() => fav(l)}>
            <Icon name={saved ? 'heart-fill' : 'heart'} />
          </button>
          {agency?.logo && (
            <Link className="pp-pcard__agency" href={agency.href} aria-label={`Listed with ${agency.name} — view agency profile`} {...ext}>
              <img src={agency.logo} alt="" width={40} height={40} />
            </Link>
          )}
          <Link className="pp-pcard__link" href={href} tabIndex={-1} aria-hidden="true" {...ext} />
        </div>
        <div className="pp-pcard__body">
          <p className="pp-pcard__price">
            {l.price ? (
              <>
                {aed(l.price)}
                {rent && <span className="pp-pcard__per">/year</span>}
              </>
            ) : done ? (
              'Price not disclosed'
            ) : (
              'Price on request'
            )}
            {done && <span className="pp-sr"> ({l.status === 'sold' ? 'sold price' : 'rented'})</span>}
          </p>
          <p className="pp-pcard__type">{l.type}</p>
          {!!specs.length && (
            <ul className="pp-pcard__specs">
              {specs.map(([i, s]) => (
                <li key={i}>
                  <Icon name={i} />
                  {s}
                </li>
              ))}
            </ul>
          )}
          {desc && <p className="pp-pcard__desc">{desc}</p>}
          <div className="pp-pcard__locrow">
            <p className="pp-pcard__loc">
              <Icon name="geo-alt" />
              <span>{loc}</span>
            </p>
          </div>
          <h3 className="pp-sr" id={'t-' + l.id}>
            {t}
          </h3>
          <Link className="pp-pcard__cta" href={href} {...ext}>
            View more details<span className="pp-sr">: {t}</span>
          </Link>
        </div>
      </article>
    );
  };
  const empty = (icon: string, h: string, p: string, btn?: ReactNode, inline = false) => (
    <div className={'pp-empty' + (inline ? ' pp-empty--inline' : '')}>
      {icon && <Icon name={icon} />}
      <h3>{h}</h3>
      <p>{p}</p>
      {btn}
    </div>
  );
  const seg = (label: string, value: string, items: [string, string][], onChange: (v: string) => void, dark = true, nameAttr = label) => (
    <div className={'pp-seg' + (dark ? ' pp-seg--dark' : '')} role="radiogroup" aria-label={label}>
      {items.map(([v, l]) => (
        <label key={v}>
          <input type="radio" name={nameAttr} value={v} checked={value === v} onChange={() => onChange(v)} />
          <span>{l}</span>
        </label>
      ))}
    </div>
  );
  const sel = (label: string, value: string, onChange: (v: string) => void, opts: [string, string][]) => (
    <label className="pp-field">
      <span className="pp-sr">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  /* ---------------- about panel ---------------- */
  const aboutSec = (id: string, title: string, body: ReactNode) =>
    body ? (
      <section key={id} className="pp-about__sec" aria-labelledby={'ab-' + id}>
        <h3 id={'ab-' + id}>{title}</h3>
        {body}
      </section>
    ) : null;
  const tags = (arr: string[]) =>
    arr?.length ? (
      <ul className="pp-tags">
        {arr.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    ) : null;

  const journey = (() => {
    const list = (b.experienceEntries || [])
      .filter((x: any) => x && (x.agencyId || String(x.agencyName || '').trim()))
      .map((x: any) => ({ ...x, current: x.current && (!x.agencyId || String(x.agencyId) === String(b.currentAgency?.id ?? '')) }));
    if (agency && !list.some((x: any) => x.current && String(x.agencyId) === String(b.currentAgency.id)))
      list.unshift({ agencyId: b.currentAgency.id, agencyName: agency.name, position: b.title || 'Real Estate Broker', start: '', current: true, desc: '', derived: true });
    list.sort((a: any, c: any) => (a.current !== c.current ? (a.current ? -1 : 1) : String(c.start || '').localeCompare(String(a.start || ''))));
    const items = list.map((x: any, i: number) => {
      const reg = x.agencyId ? agencies().find((a: any) => String(a.id) === String(x.agencyId)) : null;
      const nm = reg ? reg.name : x.agencyName;
      const href = reg ? '/agencies/' + encodeURIComponent(reg.id) : '';
      return (
        <li key={x.id || i} className={'pp-exp' + (x.current ? ' is-current' : '')}>
          <span className="pp-exp__logo">
            {reg && reg.photo ? (
              <Link href={href} aria-label={nm + ' — view agency profile'} {...ext}>
                <img src={reg.photo} alt="" width={44} height={44} />
              </Link>
            ) : (
              <Icon name="building" />
            )}
          </span>
          <div>
            <h4>
              {href ? (
                <Link href={href} {...ext}>
                  {nm}
                </Link>
              ) : (
                nm
              )}
              {x.current && <span className="pp-badge pp-badge--soft">Current</span>}
            </h4>
            <p className="pp-exp__role">{x.position || ''}</p>
            <p className="pp-note">{x.derived ? 'Current agency on Emirate08' : (x.start ? monthLabel(x.start) : 'Start date not set') + ' – ' + (x.current ? 'Present' : x.end ? monthLabel(x.end) : '')}</p>
            {x.desc && <p>{x.desc}</p>}
          </div>
        </li>
      );
    });
    const intro = paras(b.journey);
    return intro || items.length ? (
      <>
        {intro}
        {!!items.length && <ol className="pp-journey">{items}</ol>}
      </>
    ) : null;
  })();
  const why = (b.whyPoints || []).filter((w: any) => w && String(w.title || '').trim()).slice(0, 4);
  const expertise =
    (b.specialties || []).length || (b.services || []).length || (b.clients || []).length ? (
      <>
        {!!(b.specialties || []).length && (
          <>
            <h4>Specializations</h4>
            {tags(b.specialties)}
          </>
        )}
        {!!(b.services || []).length && (
          <>
            <h4>Services</h4>
            <ul className="pp-list">
              {b.services.map((s: string) => (
                <li key={s}>
                  <Icon name="check2" />
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}
        {!!(b.clients || []).length && (
          <>
            <h4>Clients I work with</h4>
            {tags(b.clients)}
          </>
        )}
      </>
    ) : null;
  const creds = [
    ...(b.brnVerified && b.brnNumber ? [{ label: 'RERA Broker Registration (BRN)', issuer: 'Dubai Land Department / RERA', value: b.brnNumber, expires: '' }] : []),
    ...(b.certifications || []).filter((c: any) => c.verified),
  ];
  const links: ReactNode[] = [];
  socials.forEach((s) =>
    links.push(
      <li key={'s' + s.url}>
        <a href={s.url} target="_blank" rel="noopener me">
          <Icon name={SOCIAL_ICON[s.platform] || 'link-45deg'} />
          {s.platform}
        </a>
      </li>,
    ),
  );
  if (safeUrl(b.website))
    links.push(
      <li key="web">
        <a href={b.website} target="_blank" rel="noopener">
          <Icon name="globe2" />
          Website
        </a>
      </li>,
    );
  if (safeUrl(b.booking))
    links.push(
      <li key="book">
        <a href={b.booking} target="_blank" rel="noopener">
          <Icon name="calendar-check" />
          Book an appointment
        </a>
      </li>,
    );
  if (agency)
    links.push(
      <li key="ag">
        <Link href={agency.href} {...ext}>
          <Icon name="building" />
          {agency.name} agency profile
        </Link>
      </li>,
    );
  const achievements = (b.achievements || []).filter((x: any) => x.approved);

  const aboutBody = [
    aboutSec('me', 'About Me', paras(b.bio)),
    aboutSec('journey', 'My Professional Journey', journey),
    aboutSec(
      'why',
      'Why Work With Me',
      why.length ? (
        <ul className="pp-why pp-why--desc">
          {why.map((w: any, i: number) => (
            <li key={i}>
              <span className="pp-why__icon">
                <Icon name={w.icon || 'check2-circle'} />
              </span>
              <div>
                <h4>{w.title}</h4>
                {w.desc && <p>{w.desc}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : null,
    ),
    aboutSec('exp', 'My Property Expertise', expertise),
    aboutSec(
      'areas',
      'Service Areas & Local Knowledge',
      areas.length ? (
        <ul className="pp-areas">
          {areas.map((x) => (
            <li key={x.name}>
              <div>
                <b>{x.name}</b>
                {x.primary && <span className="pp-badge pp-badge--soft">Primary area</span>}
              </div>
              {x.note && <p>{x.note}</p>}
            </li>
          ))}
        </ul>
      ) : null,
    ),
    aboutSec(
      'how',
      'How I Work',
      <>
        {b.approach && <p>{b.approach}</p>}
        <ol className="pp-steps">
          {STEPS.map(([s, t], i) => (
            <li key={s}>
              <span>{i + 1}</span>
              <div>
                <b>{s}</b>
                <p>{t}</p>
              </div>
            </li>
          ))}
        </ol>
      </>,
    ),
    aboutSec(
      'creds',
      'Qualifications & Credentials',
      creds.length ? (
        <ul className="pp-creds">
          {creds.map((x: any) => (
            <li key={x.label}>
              <Icon name="patch-check-fill" />
              <div>
                <b>{x.label}</b>
                <p>
                  {[x.issuer, x.value ? 'No. ' + x.value : '', x.expires ? 'Valid until ' + monthLabel(String(x.expires).slice(0, 7)) : ''].filter(Boolean).join(' · ')}
                </p>
                <p className="pp-note">Document checked by Emirate08.</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null,
    ),
    aboutSec(
      'ach',
      'Achievements & Case Studies',
      achievements.length ? (
        <ul className="pp-ach">
          {achievements.map((x: any) => (
            <li key={x.id}>
              <span className="pp-badge pp-badge--soft">{x.kind}</span>
              <b>{x.title}</b>
              <p>{x.detail}</p>
              {x.date && <p className="pp-note">{monthLabel(x.date)}</p>}
            </li>
          ))}
        </ul>
      ) : null,
    ),
    aboutSec('links', 'Professional Links', links.length ? <ul className="pp-links">{links}</ul> : null),
  ].filter(Boolean);

  /* ---------------- sidebar rows ---------------- */
  const curManual = !agency ? (b.experienceEntries || []).find((x: any) => x.current && !x.agencyId && x.agencyName) : null;
  const heroSocials = socials
    .filter((s) => ['Instagram', 'LinkedIn', 'Facebook'].includes(s.platform))
    .sort((x, y) => ['Instagram', 'LinkedIn', 'Facebook'].indexOf(x.platform) - ['Instagram', 'LinkedIn', 'Facebook'].indexOf(y.platform));
  const meta: ReactNode[] = [];
  if (b.location) meta.push(<li key="l"><Icon name="geo-alt" />{b.location}</li>);
  if (b.experience) meta.push(<li key="e"><Icon name="briefcase" />{b.experience} Years Experience</li>);
  if ((b.languages || []).length) meta.push(<li key="g"><Icon name="translate" /><span className="pp-sr">Languages: </span>{b.languages.join(', ')}</li>);

  return (
    <div className={'pp pp--broker' + (modal ? ' pp--modal' : '')}>
      {!!notices.length && (
        <div className="pp-notice" role="note">
          <Icon name="eye" />
          <div>
            {notices.map((m) => (
              <p key={m}>{m}</p>
            ))}
            {noticeAction}
          </div>
        </div>
      )}
      <main className="pp-main" id="pp-main">
        {/* header card */}
        <section className="pp-wrap pp-bhead" aria-labelledby="pp-name">
          <div className="pp-bhead__card">
            <div className="pp-bhead__banner">
              <img src={DEFAULT_BROKER_COVER} alt="" width={1600} height={520} fetchPriority="high" />
              {agency?.logo && (
                <Link className="pp-bhead__agency" href={agency.href} aria-label={agency.name + ' — view agency profile'} {...ext}>
                  <img src={agency.logo} alt={agency.name + ' logo'} width={96} height={96} />
                </Link>
              )}
            </div>
            <div className="pp-bhead__body">
              <div className="pp-portrait">{b.photo ? <img src={b.photo} alt={'Portrait of ' + name} width={240} height={240} /> : <span aria-hidden="true">{initials(name)}</span>}</div>
              <div className="pp-bhead__info">
                {!!heroSocials.length && (
                  <ul className="pp-hsocials pp-hsocials--mono" aria-label={name + ' on social media'}>
                    {heroSocials.map((s) => (
                      <li key={s.url}>
                        <a className={'is-' + s.platform.toLowerCase()} href={s.url} target="_blank" rel="noopener me" aria-label={s.platform + ' (opens in a new tab)'}>
                          <Icon name={SOCIAL_ICON[s.platform]} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="pp-bhead__name">
                  <h1 id="pp-name">{name}</h1>
                  {b.brnVerified && (
                    <span className="pp-vpill">
                      <Icon name="patch-check-fill" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="pp-role">
                  {designation}
                  {agency && (
                    <>
                      {' · '}
                      <Link href={agency.href} {...ext}>
                        {agency.name}
                      </Link>
                    </>
                  )}
                </p>
                {b.intro && <p className="pp-bdesc">{b.intro}</p>}
                {!!meta.length && <ul className="pp-meta">{meta}</ul>}
                <div className="pp-bhead__cta">
                  <button type="button" className="pp-btn pp-btn--primary" onClick={openContact}>
                    <Icon name="telephone-fill" />
                    Contact Broker
                  </button>
                  {wa && (
                    <a className="pp-btn pp-btn--outline" href={wa} target="_blank" rel="noopener">
                      <Icon name="whatsapp" className="text-[#128c3f]" />
                      WhatsApp
                    </a>
                  )}
                  <button type="button" className="pp-btn pp-btn--outline" onClick={() => copyUrl(true)}>
                    <Icon name="share-fill" />
                    Share Profile
                  </button>
                  <button type="button" className="pp-btn pp-btn--outline" onClick={() => gotoTab('reviews')}>
                    <Icon name="star" />
                    Reviews
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="pp-wrap pp-layout">
          <div className="pp-content">
            <div className="pp-tabs" role="tablist" aria-label="Profile sections" ref={tablist}>
              {tabs.map(([k, label, count], i) => (
                <button
                  key={k}
                  ref={(el) => {
                    tabRefs.current[k] = el;
                  }}
                  type="button"
                  role="tab"
                  id={'pp-tab-' + k}
                  aria-controls={'pp-panel-' + k}
                  aria-selected={tab === k}
                  tabIndex={tab === k ? 0 : -1}
                  onClick={() => selectTab(k)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  {label}
                  {count != null && <span className="pp-count">{count}</span>}
                </button>
              ))}
            </div>

            {/* LISTINGS */}
            <section className="pp-panel" role="tabpanel" id="pp-panel-listings" aria-labelledby="pp-tab-listings" tabIndex={0} hidden={tab !== 'listings'}>
              <div className="pp-sechead">
                <p className="pp-eyebrow">Available properties</p>
                <h2>Explore My Property Portfolio</h2>
                <p>Discover available properties and explore opportunities that match your lifestyle, preferences, and investment goals.</p>
              </div>
              {active.length ? (
                <>
                  <form className="pp-filters pp-filters--bar" role="search" aria-label="Filter properties" onSubmit={(e) => e.preventDefault()}>
                    <div className="pp-filters__row">
                      {seg('Buy or rent', f.purpose, [['all', 'All'], ['sale', 'For sale'], ['rent', 'For rent']], (v) => setF({ ...f, purpose: v }), true, 'purpose')}
                      {seg('Completion status', f.completion, [['all', 'Any'], ['ready', 'Ready'], ['offplan', 'Off-plan']], (v) => setF({ ...f, completion: v }), true, 'completion')}
                    </div>
                    <div className="pp-filters__selects">
                      {sel('Property type', f.ptype, (v) => setF({ ...f, ptype: v }), [['all', 'Property type'], ...types.map((t) => [t, t] as [string, string])])}
                      {sel('Location', f.area, (v) => setF({ ...f, area: v }), [['all', 'Location'], ...locs.map((t) => [t, t] as [string, string])])}
                      {sel('Price (AED)', f.price, (v) => setF({ ...f, price: v }), [['any', 'Price (AED)'], ['0-1000000', 'Up to 1M'], ['1000000-3000000', '1M – 3M'], ['3000000-6000000', '3M – 6M'], ['6000000-', '6M and above']])}
                      {sel('Beds', f.beds, (v) => setF({ ...f, beds: v }), [['any', 'Beds'], ['0', 'Studio'], ['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']])}
                      {sel('Sort by', f.sort, (v) => setF({ ...f, sort: v }), [['featured', 'Featured first'], ['newest', 'Newest'], ['price-desc', 'Price: high to low'], ['price-asc', 'Price: low to high']])}
                    </div>
                    <div className="pp-filters__meta">
                      <p className="pp-result" aria-live="polite">
                        {showing(results.length, active.length)}
                      </p>
                      <button type="button" className="pp-link" onClick={() => setF(F0)}>
                        Reset filters
                      </button>
                    </div>
                  </form>
                  <div className="pp-cards">
                    {results.length
                      ? results.map(card)
                      : empty('search', 'No properties match these filters', 'Try a different area or price range, or reset the filters.', <button type="button" className="pp-btn pp-btn--outline pp-btn--sm" onClick={() => setF(F0)}>Reset filters</button>, true)}
                  </div>
                </>
              ) : (
                empty('buildings', 'No properties available right now', `New listings appear here as soon as they are published. ${name} can also tell you about upcoming and off-market options.`, <button type="button" className="pp-btn pp-btn--outline" onClick={openContact}>Ask about upcoming properties</button>)
              )}
              <section className="pp-faq" aria-labelledby="pp-faq-h">
                <div className="pp-sechead">
                  <p className="pp-eyebrow">Frequently asked questions</p>
                  <h2 id="pp-faq-h">Questions Buyers Often Ask</h2>
                </div>
                <div className="pp-acc">
                  {faq.map(([q, a], i) => {
                    const open = openFaq.includes(i);
                    return (
                      <Fragment key={q}>
                        <h3>
                          <button type="button" className="pp-acc__btn" aria-expanded={open} aria-controls={'pp-faq-' + i} id={'pp-faq-b' + i} onClick={() => setOpenFaq(open ? openFaq.filter((x) => x !== i) : [...openFaq, i])}>
                            {q}
                            <Icon name="plus-lg" />
                          </button>
                        </h3>
                        <div className="pp-acc__panel" id={'pp-faq-' + i} role="region" aria-labelledby={'pp-faq-b' + i} hidden={!open}>
                          <p>{a}</p>
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              </section>
            </section>

            {/* ABOUT */}
            <section className="pp-panel" role="tabpanel" id="pp-panel-about" aria-labelledby="pp-tab-about" tabIndex={0} hidden={tab !== 'about'}>
              <div className="pp-sechead">
                <p className="pp-eyebrow">About</p>
                <h2>Get to Know {first}</h2>
              </div>
              {aboutBody.length ? aboutBody : <div className="pp-empty"><p>More information is coming soon.</p></div>}
            </section>

            {/* REVIEWS */}
            <section className="pp-panel" role="tabpanel" id="pp-panel-reviews" aria-labelledby="pp-tab-reviews" tabIndex={0} hidden={tab !== 'reviews'}>
              <div className="pp-sechead">
                <p className="pp-eyebrow">Client reviews</p>
                <h2>Read My Reviews</h2>
                <p>Reviews are hosted on independent platforms. Each link opens the platform’s own page in a new tab.</p>
              </div>
              {reviewSources.length ? (
                <>
                  <ul className="pp-revsrc">
                    {reviewSources.map((x) => {
                      let host = '';
                      try {
                        host = new URL(x.url).hostname.replace(/^www\./, '');
                      } catch {}
                      return (
                        <li key={x.url}>
                          <span className="pp-revsrc__icon">
                            <Icon name={REVIEW_ICON[x.platform] || 'chat-square-quote'} />
                          </span>
                          <div>
                            <b>{x.platform}</b>
                            <p className="pp-note">{host}</p>
                          </div>
                          <a className="pp-btn pp-btn--outline pp-btn--sm" href={x.url} target="_blank" rel="noopener nofollow">
                            View Reviews<span className="pp-sr"> on {x.platform} (opens in a new tab)</span>
                            <Icon name="box-arrow-up-right" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="pp-note" style={{ marginTop: 12 }}>
                    Emirate08 doesn’t show ratings or review text unless they come from a verified platform integration.
                  </p>
                </>
              ) : (
                empty('chat-quote', 'No review pages linked yet', `${name} hasn’t linked an external review page. Ask for references when you get in touch.`)
              )}
            </section>

            {/* SOLD */}
            {showSold && (
              <section className="pp-panel" role="tabpanel" id="pp-panel-sold" aria-labelledby="pp-tab-sold" tabIndex={0} hidden={tab !== 'sold'}>
                <div className="pp-sechead">
                  <p className="pp-eyebrow">Track record</p>
                  <h2>Completed Sales & Rentals</h2>
                  <p>Properties I have sold or let. Completed deals are never shown as available.</p>
                </div>
                {completed.length ? (
                  <>
                    <form className="pp-filters" aria-label="Filter completed transactions" onSubmit={(e) => e.preventDefault()}>
                      <div className="pp-filters__row">
                        {seg('Transaction type', sf.kind, [['all', 'All completed'], ['sold', 'Sold'], ['rented', 'Rented']], (v) => setSf({ ...sf, kind: v }), false, 'kind')}
                        {sel('Property type', sf.ptype, (v) => setSf({ ...sf, ptype: v }), [['all', 'All types'], ...uniq(completed.map((l) => l.type)).sort().map((t) => [t, t] as [string, string])])}
                        {sel('Location', sf.area, (v) => setSf({ ...sf, area: v }), [['all', 'All locations'], ...uniq(completed.map((l) => l.area)).sort().map((t) => [t, t] as [string, string])])}
                      </div>
                      <p className="pp-result" aria-live="polite">
                        {soldOut.length === completed.length ? plural(completed.length, 'completed transaction') : soldOut.length + ' of ' + plural(completed.length, 'completed transaction')}
                      </p>
                    </form>
                    <div className="pp-cards">{soldOut.length ? soldOut.map(card) : empty('', 'No transactions match', '', null, true)}</div>
                  </>
                ) : (
                  empty('check2-circle', 'No completed transactions shown yet', `Completed sales and rentals appear here once ${first} chooses to show them.`)
                )}
              </section>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="pp-side" aria-label="Profile summary">
            <section className="pp-scard" aria-labelledby="sc-perf">
              <h2 id="sc-perf">Performance summary</h2>
              <dl className="pp-pgrid">
                {([['Active listings', perf.active], ['For sale', perf.sale], ['For rent', perf.rent], ['Off-plan', perf.offplan]] as [string, number][]).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              {showSold ? (
                <>
                  <dl className="pp-rows">
                    {([['Sales recorded', perf.sales], ['Rentals recorded', perf.rentals], ['Recorded sale value', perf.saleValue ? compactAed(perf.saleValue) : '—'], ['Recorded rental value', perf.rentValue ? compactAed(perf.rentValue) + ' /yr' : '—']] as [string, ReactNode][]).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="pp-note">Counted from listings marked sold or rented on Emirate08 only.</p>
                </>
              ) : (
                <p className="pp-note">Completed transactions are not shown on this profile.</p>
              )}
            </section>
            <section className="pp-scard" aria-labelledby="sc-about">
              <h2 id="sc-about">About the broker</h2>
              {!!(b.specialties || []).length && (
                <>
                  <h3>Specialisations</h3>
                  {tags(b.specialties)}
                </>
              )}
              {!!areas.length && (
                <>
                  <h3>Service areas</h3>
                  {tags(areas.map((a) => a.name))}
                </>
              )}
              <dl className="pp-rows pp-rows--about">
                {b.experience ? (
                  <div>
                    <dt>Experience</dt>
                    <dd>{b.experience} years</dd>
                  </div>
                ) : null}
                {!!(b.languages || []).length && (
                  <div>
                    <dt>Languages</dt>
                    <dd>{b.languages.join(', ')}</dd>
                  </div>
                )}
                <div>
                  <dt>Brokerage</dt>
                  <dd>
                    {agency ? (
                      <Link href={agency.href} {...ext}>
                        {agency.name}
                      </Link>
                    ) : curManual ? (
                      curManual.agencyName
                    ) : (
                      'Independent'
                    )}
                  </dd>
                </div>
                {b.brnNumber && (
                  <div>
                    <dt>RERA / BRN</dt>
                    <dd>
                      {String(b.brnNumber).replace(/^BRN\s*/, '')}
                      <small>{b.brnVerified ? 'Verified by Emirate08' : 'Not yet verified'}</small>
                    </dd>
                  </div>
                )}
              </dl>
              {!!(b.certifications || []).length && (
                <>
                  <h3>Professional credentials</h3>
                  <ul className="pp-credlist">
                    {b.certifications.map((x: any) => (
                      <li key={x.label}>
                        <Icon name={x.verified ? 'patch-check-fill' : 'circle'} />
                        <span>
                          {x.label} <em>({x.verified ? 'verified' : 'not verified'})</em>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section className="pp-scard" aria-labelledby="sc-contact">
              <h2 id="sc-contact" className="pp-scard__lg">
                Contact {first}
              </h2>
              {PREFERRED_LABEL[b.preferred] && <p className="pp-note">Preferred: {PREFERRED_LABEL[b.preferred]}</p>}
              <div className="pp-cstack">
                <button type="button" className="pp-cbtn pp-cbtn--primary" onClick={openContact}>
                  <Icon name="envelope" />
                  Send a Quick Enquiry
                  <Icon name="arrow-right" />
                </button>
                {phone && (
                  <a className="pp-cbtn" href={'tel:+' + digits(phone)}>
                    <Icon name="telephone" />
                    Direct Call
                    <Icon name="arrow-right" />
                  </a>
                )}
                {wa && (
                  <a className="pp-cbtn pp-cbtn--wa" href={wa} target="_blank" rel="noopener">
                    <Icon name="whatsapp" />
                    WhatsApp
                    <Icon name="arrow-right" />
                  </a>
                )}
              </div>
            </section>
            <section className="pp-scard" aria-labelledby="sc-share" ref={shareCard}>
              <h2 id="sc-share">Share this profile</h2>
              <div className="pp-share">
                <label className="pp-sr" htmlFor="pp-share-url">
                  Profile link
                </label>
                <input id="pp-share-url" ref={shareInput} readOnly value={url} />
                <button type="button" className="pp-btn pp-btn--primary pp-btn--sm" onClick={() => copyUrl(false)}>
                  <Icon name="link-45deg" />
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="pp-note" aria-live="polite">
                {copyStatus}
              </p>
            </section>
          </aside>
        </div>

        <nav className="pp-wrap pp-crumbs" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/" {...ext}>
                Home
              </Link>
            </li>
            <li>
              <Link href="/agents" {...ext}>
                Find an agent
              </Link>
            </li>
            <li aria-current="page">{name}</li>
          </ol>
        </nav>
      </main>

      <div className="pp-mbar" role="region" aria-label={'Contact ' + name}>
        {wa && (
          <a href={wa} target="_blank" rel="noopener">
            <Icon name="whatsapp" />
            WhatsApp
          </a>
        )}
        {phone && (
          <a href={'tel:+' + digits(phone)}>
            <Icon name="telephone" />
            Call
          </a>
        )}
        <button type="button" className="is-primary" onClick={openContact}>
          <Icon name="envelope" />
          Enquire
        </button>
      </div>

      {modal && (
        <div className="pp-modal" onKeyDown={onModalKey}>
          <div className="pp-modal__scrim" onClick={closeContact} />
          <div className="pp-modal__box" role="dialog" aria-modal="true" aria-labelledby="pp-cm-h" ref={modalBox}>
            <div className="pp-modal__head">
              <h2 id="pp-cm-h">Contact {name}</h2>
              <button type="button" className="pp-icon" onClick={closeContact} aria-label="Close">
                <Icon name="x-lg" />
              </button>
            </div>
            {sent ? (
              <div className="pp-success" tabIndex={-1}>
                <Icon name="check-circle-fill" />
                <h3>{sent === 'preview' ? 'Enquiry form works' : 'Enquiry sent'}</h3>
                <p>{sent === 'preview' ? 'This is a preview, so nothing was sent.' : `${first} will get back to you soon. You’ll also find this enquiry in your Emirate08 account.`}</p>
                <button type="button" className="pp-btn pp-btn--outline pp-btn--sm" style={{ marginTop: 12 }} onClick={() => setSent('')}>
                  Send another enquiry
                </button>
              </div>
            ) : (
              <form className="pp-form" noValidate onSubmit={submit}>
                <div className="pp-form__fields">
                  {(
                    [
                      ['name', 'Name', 'text', 'name', ''],
                      ['email', 'Email', 'email', 'email', ''],
                      ['phone', 'Phone', 'tel', 'tel', '+971'],
                      ['message', 'Message', 'textarea', '', ''],
                    ] as const
                  ).map(([k, label, type, auto, ph]) => (
                    <div key={k} className={'pp-ff' + (ferr[k] ? ' is-invalid' : '')}>
                      <label htmlFor={'modal-' + k}>{label}</label>
                      {type === 'textarea' ? (
                        <textarea id={'modal-' + k} name={k} rows={4} required aria-required="true" aria-invalid={!!ferr[k]} aria-describedby={ferr[k] ? 'modal-' + k + '-err' : undefined} value={form[k]} onChange={setField(k)} />
                      ) : (
                        <input id={'modal-' + k} name={k} type={type} autoComplete={auto} placeholder={ph || undefined} required aria-required="true" aria-invalid={!!ferr[k]} aria-describedby={ferr[k] ? 'modal-' + k + '-err' : undefined} value={form[k]} onChange={setField(k)} />
                      )}
                      <p className="pp-ff__err" id={'modal-' + k + '-err'} hidden={!ferr[k]}>
                        {ferr[k]}
                      </p>
                    </div>
                  ))}
                </div>
                {sendErr && (
                  <p className="pp-ff__err" role="alert" style={{ marginBottom: 12 }}>
                    {sendErr}
                  </p>
                )}
                <button className="pp-btn pp-btn--primary pp-btn--block" type="submit" disabled={sending}>
                  <Icon name="send" />
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
