'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Field, invalidProps } from '@/components/ui/Field';
import { Avatar } from '@/components/broker/Avatar';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import {
  currentUser,
  data,
  defaultPortfolio,
  listing,
  log,
  photoOf,
  saveListing,
  saveUser,
  uniqueSlug,
  userById,
} from '@/lib/store';
import { AREAS, STATUS } from '@/config/reference';
import { IMG, PIMG } from '@/config/images';
import { uploadMediaDataURL } from '@/lib/mediaClient';
import { RX, clone, cx, digits, fileToDataURL, initialsOf, slugify } from '@/lib/utils';
import { absUrl, copyText, share } from '@/lib/share';
import { routes } from '@/lib/routes';
import { SectionNav, useHashTabs } from './shared';

/* Profile — public portfolio management (old profile.html + portfolio.js).
 * Edits are kept as a draft (user.portfolioDraft) until “Publish changes”, so brokers can preview first.
 * Listing visibility and featured switches apply to listings immediately. */

const COVERS = [
  'hero-dubai',
  'dubai-marina',
  'downtown-dubai',
  'business-bay',
  'dubai-hills',
  'palm-jumeirah',
  'cta-dubai-dusk',
  'downtown-aerial',
]
  .map((n) => IMG + n + '.webp')
  .concat(['dubai-skyline', 'marina-night', 'downtown-boulevard'].map((n) => PIMG + n + '.webp'));

const TABS = ['appearance', 'professional', 'contact', 'listings', 'visibility'];
const NAV = [
  ['appearance', 'image', 'Portfolio appearance'],
  ['professional', 'person-vcard', 'Professional information'],
  ['contact', 'telephone', 'Public contact details'],
  ['listings', 'buildings', 'Portfolio listings'],
  ['visibility', 'globe2', 'Visibility & sharing'],
];
/* field key → [tab, input id] for focusing the first invalid field */
const FIELD_AT = {
  displayName: ['professional', 'pf-name'],
  publicEmail: ['contact', 'pf-email'],
  publicPhone: ['contact', 'pf-phone'],
  whatsapp: ['contact', 'pf-wa'],
  agencyWeb: ['contact', 'pf-agencyweb'],
  slug: ['visibility', 'pf-slug'],
};

function stripTime(p) {
  const c = clone(p);
  delete c.updatedAt;
  if (c.agency && !c.agency.name && !c.agency.website && !c.agency.orn) c.agency = null;
  return c;
}
function changed(D) {
  const draft = stripTime(D);
  const saved = stripTime(currentUser().portfolio);
  if (draft.featuredOrder && !saved.featuredOrder?.length) delete draft.featuredOrder;
  return JSON.stringify(draft) !== JSON.stringify(saved);
}
function setPath(o, p, v) {
  const ks = p.split('.');
  const last = ks.pop();
  const t = ks.reduce((a, k) => (a[k] = a[k] || {}), o);
  t[last] = v;
}
function getPath(o, p) {
  return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
}
function featuredListings() {
  return data().listings.filter((l) => l.display.portfolioFeatured && l.status === 'published');
}
/** Keeps the saved order for listings that are still featured and appends newly featured ones. */
function featOrder(order) {
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
  const D = clone(u.portfolioDraft || u.portfolio);
  D.agency = D.agency || { name: '', website: '', orn: '' };
  if (u.type === 'agency') {
    D.displayName = D.displayName || u.agency?.name || u.legalName || u.name;
    D.title = D.title || 'Real Estate Agency';
    D.agency = {
      ...D.agency,
      name: D.agency.name || u.agency?.name || D.displayName,
      orn: D.agency.orn || u.credentials?.orn || '',
    };
  }
  D.featuredOrder = featOrder(D.featuredOrder);
  return D;
}
const listText = (D) => ({ languages: (D.languages || []).join(', '), specialties: (D.specialties || []).join(', ') });

function Toggle({ id, checked, onChange, label, description, className }) {
  return (
    <label className={cx('flex cursor-pointer items-center justify-between gap-4', className)} htmlFor={id}>
      <span>
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
      <span className="relative">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle" aria-hidden="true" />
      </span>
    </label>
  );
}

export function Portfolio() {
  useStoreVersion();
  const { toast, confirm } = useFeedback();
  const [tab, go] = useHashTabs(TABS);
  const [D, setD] = useState(initDraft);
  const [lists, setLists] = useState(() => listText(D));
  const [err, setErr] = useState<Record<string, string>>({});
  const [showCovers, setShowCovers] = useState(false);
  const [pv, setPv] = useState({ open: false, vp: 'desktop', t: 0 });
  const focusLastCred = useRef(false);
  const user = currentUser();
  const agencyAccount = user?.type === 'agency';
  const dirty = changed(D);
  const sectionNav = agencyAccount
    ? NAV.map(([key, icon, label]) => [key, icon, key === 'professional' ? 'Agency information' : key === 'listings' ? 'Property portfolio' : label])
    : NAV;

  useEffect(() => {
    if (!focusLastCred.current) return;
    focusLastCred.current = false;
    const all = document.querySelectorAll('[data-cr="label"]');
    (all[all.length - 1] as HTMLElement)?.focus();
  });

  /* ---------- draft persistence ---------- */
  const saveDraft = (next) => {
    setD(next);
    const cur = currentUser();
    if (changed(next)) cur.portfolioDraft = clone(next);
    else delete cur.portfolioDraft;
    saveUser(cur);
    const stored = userById(cur.id);
    if (JSON.stringify(stored?.portfolioDraft || null) !== JSON.stringify(cur.portfolioDraft || null))
      toast('Browser storage is full — try a smaller photo.', { icon: 'exclamation-circle' });
  };
  const update = (path, value) => {
    const next = clone(D);
    setPath(next, path, value);
    saveDraft(next);
  };
  const clearErr = (k) => err[k] && setErr({ ...err, [k]: '' });

  /* ---------- validation + publish ---------- */
  const validate = () => {
    const er: Record<string, string> = {};
    if (!D.displayName || D.displayName.trim().length < 2) er.displayName = 'Enter the name buyers should see.';
    if (D.publicEmail && !RX.email.test(D.publicEmail)) er.publicEmail = 'Enter a valid email address.';
    ['publicPhone', 'whatsapp'].forEach((k) => {
      if (D[k] && digits(D[k]).length < 9) er[k] = 'Enter a full phone number with country code.';
    });
    if (D.agency && D.agency.website && !/^https:\/\/\S+\.\S+/.test(D.agency.website))
      er.agencyWeb = 'Use a full https:// link.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(D.slug || '')) er.slug = 'Use lowercase letters, numbers and single hyphens.';
    else if (uniqueSlug(D.slug, user.id) !== D.slug)
      er.slug = 'This URL is taken. Try ' + uniqueSlug(D.slug, user.id) + '.';
    setErr(er);
    const first = Object.keys(FIELD_AT).find((k) => er[k]);
    if (first) {
      setPv((s) => ({ ...s, open: false }));
      go(FIELD_AT[first][0]);
      setTimeout(() => document.getElementById(FIELD_AT[first][1])?.focus(), 40);
      toast('Check the highlighted field before publishing.', { icon: 'exclamation-circle' });
      return false;
    }
    return true;
  };
  const publish = () => {
    if (!validate()) return;
    const cur = currentUser();
    const d = clone(D);
    if (d.agency && !d.agency.name) d.agency = null;
    d.updatedAt = new Date().toISOString();
    cur.portfolio = d;
    delete cur.portfolioDraft;
    saveUser(cur);
    log(agencyAccount ? 'Published agency portfolio changes' : 'Published portfolio changes', agencyAccount ? 'building' : 'person-badge');
    setPv((s) => ({ ...s, open: false }));
    toast(
      <>
        {agencyAccount ? 'Agency portfolio updated.' : 'Portfolio updated.'}{' '}
        <Link className="underline" href={profilePath}>
          View it
        </Link>
      </>,
    );
  };
  const discard = async () => {
    const ok = await confirm({
      title: 'Discard unpublished changes?',
      body: 'Your public portfolio stays as it is now.',
      ok: 'Discard',
      danger: true,
    });
    if (!ok) return;
    const cur = currentUser();
    delete cur.portfolioDraft;
    saveUser(cur);
    const next = initDraft();
    setD(next);
    setLists(listText(next));
    setErr({});
    toast('Changes discarded.');
  };

  /* ---------- field bindings ---------- */
  const text = (path, errKey = undefined) => ({
    value: getPath(D, path) ?? '',
    onChange: (e) => {
      if (errKey) clearErr(errKey);
      update(path, e.target.value);
    },
  });
  const setList = (k) => (e) => {
    const v = e.target.value;
    setLists({ ...lists, [k]: v });
    update(
      k,
      v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    );
  };
  const toggleArea = (a) => {
    const next = clone(D);
    next.areas = next.areas || [];
    const i = next.areas.indexOf(a);
    if (i > -1) next.areas.splice(i, 1);
    else next.areas.push(a);
    saveDraft(next);
  };
  const credEdit = (i, k, v) => {
    const next = clone(D);
    next.credentials[i][k] = v;
    next.credentials[i].verified = false;
    saveDraft(next);
  };
  const credDel = (i) => {
    const next = clone(D);
    next.credentials.splice(i, 1);
    saveDraft(next);
  };
  const credAdd = () => {
    const next = clone(D);
    next.credentials = next.credentials || [];
    next.credentials.push({ label: '', value: '', verified: false });
    focusLastCred.current = true;
    saveDraft(next);
  };
  const onImage = (key, max, q) => async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const s = await fileToDataURL(f, max, q).catch(() => null);
    if (!s) {
      toast('That file isn’t an image we can use.', { icon: 'exclamation-circle' });
      return;
    }
    try {
      const media = await uploadMediaDataURL(s, f.name, f.name);
      update(key, media.url);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not upload this image.', { icon: 'exclamation-circle' });
    }
  };

  /* ---------- listings (immediate) ---------- */
  const rows = data().listings.filter((l) => l.status !== 'archived');
  const feats = featuredListings();
  const order = featOrder(D.featuredOrder);
  const setVisible = (id, on) => {
    const l = listing(id);
    l.display.visible = on;
    saveListing(l);
    toast(on ? 'Shown on your portfolio.' : 'Hidden from your portfolio and search.');
  };
  const toggleFeatured = (id) => {
    const l = listing(id);
    l.display.portfolioFeatured = !l.display.portfolioFeatured;
    saveListing(l);
    saveDraft({ ...clone(D), featuredOrder: featOrder(D.featuredOrder) });
  };
  const move = (i, dir) => {
    const o = order.slice();
    const j = i + dir;
    [o[i], o[j]] = [o[j], o[i]];
    saveDraft({ ...clone(D), featuredOrder: o });
  };

  /* ---------- sharing ---------- */
  const publishedSlug = (currentUser().portfolio || {}).slug;
  const profilePath = '/brokers/' + encodeURIComponent(publishedSlug);
  const copyProfile = () =>
    copyText(absUrl(profilePath)).then(
      () => toast('Profile link copied.', { icon: 'link-45deg' }),
      () => window.prompt('Copy your profile link:', absUrl(profilePath)),
    );

  /* ---------- preview ---------- */
  const openPreview = (vp) => setPv({ open: true, vp: vp || pv.vp, t: Date.now() });

  const coverPos = D.coverPos == null ? 50 : D.coverPos;
  const allAreas = AREAS.Dubai.concat((D.areas || []).filter((a) => AREAS.Dubai.indexOf(a) < 0));
  const verified = user.credentialStatus === 'verified';

  const publishBtn = (className = undefined) => (
    <button type="button" className={cx('btn btn-dark', className)} disabled={!dirty} onClick={publish}>
      <Icon name="send" />
      Publish changes
    </button>
  );

  return (
    <div className="mx-auto max-w-[1160px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.12em] text-muted uppercase">{agencyAccount ? 'Agency · public portfolio' : 'Profile · public portfolio'}</p>
          <h1 className="h2 mt-1 text-[24px] lg:text-[28px]">{agencyAccount ? 'Build your agency portfolio' : 'What buyers see'}</h1>
          <p className="mt-1 max-w-[620px] text-[14px] text-muted">
            {agencyAccount ? 'Present your agency, services, team properties and business contact details to buyers.' : 'Everything on this page appears on your public broker portfolio.'} Private account details live in{' '}
            <Link className="link" href="/account">
              Account
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={profilePath} className="btn btn-dark btn-lg" target="_blank" rel="noopener">
            <Icon name="box-arrow-up-right" />
            {agencyAccount ? 'View Public Agency Portfolio' : 'View My Public Portfolio'}
          </Link>
        </div>
      </div>

      {/* Draft bar */}
      <div
        className={cx(
          'mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3',
          dirty ? 'border-warn/40' : 'border-line',
        )}
      >
        <p className="flex items-center gap-2 text-[13px]" role="status">
          {dirty ? (
            <>
              <Icon name="pencil-square" className="h-4 w-4 text-warn" />
              <span>
                <b>Unpublished changes.</b> Preview them, then publish to update your public portfolio.
              </span>
            </>
          ) : (
            <>
              <Icon name="check-circle-fill" className="h-4 w-4 text-ok" />
              Your public portfolio is up to date.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => openPreview('desktop')}>
            <Icon name="display" />
            Preview desktop
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => openPreview('mobile')}>
            <Icon name="phone" />
            Preview mobile
          </button>
          {dirty && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={discard}>
              Discard changes
            </button>
          )}
          {publishBtn('btn-sm')}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SectionNav label={agencyAccount ? 'Agency portfolio sections' : 'Profile sections'} items={sectionNav} current={tab} onSelect={go} />

        <div className="min-w-0">
          {/* 1 APPEARANCE */}
          <section className="card p-5 sm:p-7" hidden={tab !== 'appearance'}>
            <h2 className="h3">{agencyAccount ? 'Agency branding' : 'Portfolio appearance'}</h2>
            <p className="mt-1 text-[13px] text-muted">
              {agencyAccount ? 'Set the cover and company logo buyers will see on your agency page.' : 'Your cover banner and photo lead the portfolio, like the header of a personal website.'}
            </p>
            <div className="mt-6 overflow-hidden rounded-lg border border-line bg-paper" aria-label="Header preview">
              <div className="relative h-[150px] bg-ink sm:h-[190px]">
                {D.cover && (
                  <img
                    alt=""
                    src={D.cover}
                    className="h-full w-full object-cover"
                    style={{ objectPosition: 'center ' + coverPos + '%' }}
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-ink-deep/40 to-transparent" />
              </div>
              <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
                <div className="relative -mt-10">
                  <Avatar
                    person={{ photo: D.photo, initials: initialsOf(D.displayName || user.name), tone: 1 }}
                    size={88}
                    square={agencyAccount}
                    className="ring-4 ring-white"
                  />
                </div>
                <div className="pb-1">
                  <p className="font-display text-[18px] font-semibold text-ink">{D.displayName || user.name}</p>
                  <p className="text-[13px] text-muted">
                    {agencyAccount ? (D.title || 'Real Estate Agency') : (D.title || '') + (D.agency && D.agency.name ? ' · ' + D.agency.name : ' · Independent broker')}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="label">Cover image</p>
                <div className="flex flex-wrap gap-2">
                  <label className="btn btn-outline btn-sm cursor-pointer" htmlFor="pf-cover">
                    <Icon name="upload" />
                    Upload cover
                  </label>
                  <input
                    id="pf-cover"
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onImage('cover', 1600, 0.74)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-expanded={showCovers}
                    onClick={() => setShowCovers(!showCovers)}
                  >
                    Choose a Dubai photo
                  </button>
                </div>
                {showCovers && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {COVERS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cx(
                          'h-14 w-20 overflow-hidden rounded border-2',
                          D.cover === c ? 'border-ink' : 'border-transparent',
                        )}
                        aria-label="Use this cover"
                        aria-pressed={D.cover === c}
                        onClick={() => update('cover', c)}
                      >
                        <img src={c} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                <label className="label mt-4" htmlFor="pf-coverpos">
                  Cover position <span className="opt">{coverPos}%</span>
                </label>
                <input
                  id="pf-coverpos"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  className="w-full accent-[#142326]"
                  value={coverPos}
                  onChange={(e) => update('coverPos', +e.target.value)}
                />
                <p className="hint">Drag to choose which part of the image shows in the banner.</p>
              </div>
              <div>
                <p className="label">{agencyAccount ? 'Company logo' : 'Profile photo'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="btn btn-outline btn-sm cursor-pointer" htmlFor="pf-photo">
                    <Icon name={agencyAccount ? 'buildings' : 'person-bounding-box'} />
                    {agencyAccount ? 'Upload logo' : 'Upload photo'}
                  </label>
                  <input
                    id="pf-photo"
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onImage('photo', 420, 0.8)}
                  />
                  {D.photo && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-danger"
                      onClick={() => update('photo', '')}
                    >
                      Remove photo
                    </button>
                  )}
                </div>
                <p className="hint">{agencyAccount ? 'Use a square company logo. Without one, the agency initials are shown.' : 'A clear, recent head-and-shoulders photo. Without one, your initials are shown.'}</p>
              </div>
            </div>
          </section>

          {/* 2 PROFESSIONAL */}
          <section className="card p-5 sm:p-7" hidden={tab !== 'professional'}>
            <h2 className="h3">{agencyAccount ? 'Agency information' : 'Professional information'}</h2>
            <p className="mt-1 text-[13px] text-muted">{agencyAccount ? 'Tell buyers what your agency does and where your team works.' : 'Shown in your portfolio header, About section and sidebar.'}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field id="pf-name" label={agencyAccount ? 'Agency name' : 'Display name'} error={err.displayName}>
                <input
                  id="pf-name"
                  className="input"
                  {...text('displayName', 'displayName')}
                  {...invalidProps('pf-name', err.displayName)}
                />
              </Field>
              <Field id="pf-title" label="Professional title">
                <input
                  id="pf-title"
                  className="input"
                  placeholder={agencyAccount ? 'e.g. Dubai residential and commercial real estate' : 'e.g. Independent Real Estate Broker'}
                  {...text('title')}
                />
              </Field>
              {(
                [
                  ['headline', 'pf-headline', agencyAccount ? 'Agency headline' : 'Professional headline', 120, agencyAccount ? 'A clear line about your agency' : 'One line about who you help and where'],
                  ['intro', 'pf-intro', agencyAccount ? 'Directory introduction' : 'Short introduction', 200, 'Used in directory cards and link previews'],
                ] satisfies [string, string, string, number, string][]
              ).map(([k, id, label, max, ph]) => (
                <Field
                  key={k}
                  id={id}
                  label={label}
                  className="sm:col-span-2"
                  labelAside={
                    <span className="text-2xs text-muted">
                      {(D[k] || '').length} / {max}
                    </span>
                  }
                >
                  <input id={id} className="input" maxLength={max} placeholder={ph} {...text(k)} />
                </Field>
              ))}
              <Field
                id="pf-bio"
                label={agencyAccount ? 'About your agency' : 'Full biography'}
                className="sm:col-span-2"
                labelAside={<span className="text-2xs text-muted">{(D.bio || '').length} / 2000</span>}
              >
                <textarea
                  id="pf-bio"
                  className="textarea min-h-[180px]"
                  maxLength={2000}
                  placeholder={agencyAccount ? 'Describe your agency, the clients you serve and how your team works. Separate paragraphs with a blank line.' : 'Experience, the clients you work with and how you work. Separate paragraphs with a blank line.'}
                  {...text('bio')}
                />
              </Field>
              {!agencyAccount && <Field id="pf-exp" label="Years of experience">
                <input
                  id="pf-exp"
                  className="input"
                  inputMode="numeric"
                  maxLength={2}
                  value={D.experience ?? ''}
                  onChange={(e) => update('experience', digits(e.target.value) ? +digits(e.target.value) : '')}
                />
              </Field>}
              {!agencyAccount && <Field id="pf-lang" label="Languages" optional="comma separated">
                <input
                  id="pf-lang"
                  className="input"
                  placeholder="English, Arabic"
                  value={lists.languages}
                  onChange={setList('languages')}
                />
              </Field>}
              <div className="field sm:col-span-2">
                <span className="label">Service locations</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Service locations">
                  {allAreas.map((a) => {
                    const on = (D.areas || []).indexOf(a) > -1;
                    return (
                      <button
                        key={a}
                        type="button"
                        className="tog-chip"
                        aria-pressed={on}
                        onClick={() => toggleArea(a)}
                      >
                        {on && <Icon name="check-lg" className="h-3.5 w-3.5" />}
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field
                id="pf-spec"
                label={agencyAccount ? 'Services & property specialisations' : 'Areas of expertise & property specialisations'}
                optional="comma separated"
                className="sm:col-span-2"
              >
                <input
                  id="pf-spec"
                  className="input"
                  placeholder={agencyAccount ? 'Residential sales, leasing, off-plan advisory' : 'Waterfront apartments, Off-plan, Leasing'}
                  value={lists.specialties}
                  onChange={setList('specialties')}
                />
              </Field>
            </div>
            {!agencyAccount && <div className="mt-8 border-t border-line pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="h4">Professional credentials</h3>
                  <p className="mt-1 text-[13px] text-muted">
                    Shown as verified only after Emirate08 reviews them. Your RERA BRN is managed in{' '}
                    <Link className="link" href="/account#credentials">
                      Account › Credentials
                    </Link>
                    .
                  </p>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={credAdd}>
                  <Icon name="plus-lg" />
                  Add credential
                </button>
              </div>
              <ul className="mt-4 space-y-2">
                {(D.credentials || []).length ? (
                  D.credentials.map((c, i) => {
                    const ok = c.verified && verified;
                    return (
                      <li
                        key={i}
                        className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1.4fr_1fr_auto_auto] sm:items-center"
                      >
                        <div>
                          <label className="sr-only" htmlFor={'cr-l-' + i}>
                            Credential
                          </label>
                          <input
                            id={'cr-l-' + i}
                            className="input h-9 text-[13px]"
                            data-cr="label"
                            value={c.label}
                            placeholder="e.g. Certified off-plan specialist"
                            onChange={(e) => credEdit(i, 'label', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="sr-only" htmlFor={'cr-v-' + i}>
                            Issuer or number
                          </label>
                          <input
                            id={'cr-v-' + i}
                            className="input h-9 text-[13px]"
                            value={c.value || ''}
                            placeholder="Issuer or number"
                            onChange={(e) => credEdit(i, 'value', e.target.value)}
                          />
                        </div>
                        <span className={'badge ' + (ok ? 'badge-ok' : 'badge-muted')}>
                          {ok ? 'Verified' : 'Not verified'}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost h-8 w-8 px-0 text-danger"
                          aria-label="Remove credential"
                          onClick={() => credDel(i)}
                        >
                          <Icon name="trash3" />
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="rounded-lg border border-dashed border-line p-4 text-center text-[13px] text-muted">
                    No additional credentials.
                  </li>
                )}
              </ul>
            </div>}
          </section>

          {/* 3 CONTACT */}
          <section className="card p-5 sm:p-7" hidden={tab !== 'contact'}>
            <h2 className="h3">{agencyAccount ? 'Agency contact details' : 'Public contact details'}</h2>
            <p className="mt-1 text-[13px] text-muted">
              {agencyAccount ? 'Use contact details for your office. Your personal account email and mobile stay private.' : 'Use business contact details. Your personal email and mobile in Account are never shown publicly.'}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field id="pf-email" label="Public business email" error={err.publicEmail}>
                <input
                  id="pf-email"
                  type="email"
                  className="input"
                  {...text('publicEmail', 'publicEmail')}
                  {...invalidProps('pf-email', err.publicEmail)}
                />
              </Field>
              <Field id="pf-phone" label="Public business phone" error={err.publicPhone}>
                <input
                  id="pf-phone"
                  type="tel"
                  className="input"
                  placeholder="+971 50 123 4567"
                  {...text('publicPhone', 'publicPhone')}
                  {...invalidProps('pf-phone', err.publicPhone)}
                />
              </Field>
              <Field
                id="pf-wa"
                label="WhatsApp business number"
                error={err.whatsapp}
                hint="Buyers’ WhatsApp button opens a chat with this number."
              >
                <input
                  id="pf-wa"
                  type="tel"
                  className="input"
                  placeholder="+971 50 123 4567"
                  {...text('whatsapp', 'whatsapp')}
                  {...invalidProps('pf-wa', err.whatsapp)}
                />
              </Field>
              <Field id="pf-pref" label="Preferred contact method">
                <select id="pf-pref" className="select" {...text('preferred')}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="call">Phone call</option>
                  <option value="email">Email</option>
                </select>
              </Field>
            </div>
            <div className="mt-8 border-t border-line pt-6">
              <h3 className="h4">{agencyAccount ? 'Company details' : 'Agency affiliation'}</h3>
              <p className="mt-1 text-[13px] text-muted">
                {agencyAccount ? 'Add your public website and RERA office registration number.' : 'Independent brokers can leave this empty. If you work with an agency, its name and website appear on your portfolio.'}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {!agencyAccount && <Field id="pf-agency" label="Agency name" optional="optional">
                  <input id="pf-agency" className="input" placeholder="Independent" {...text('agency.name')} />
                </Field>}
                <Field id="pf-agencyweb" label={agencyAccount ? 'Company website' : 'Agency website'} error={err.agencyWeb}>
                  <input
                    id="pf-agencyweb"
                    type="url"
                    className="input"
                    placeholder="https://"
                    {...text('agency.website', 'agencyWeb')}
                    {...invalidProps('pf-agencyweb', err.agencyWeb)}
                  />
                </Field>
                <Field id="pf-orn" label={agencyAccount ? 'RERA ORN' : 'Agency ORN'}>
                  <input id="pf-orn" className="input" {...text('agency.orn')} />
                </Field>
                {agencyAccount && <Field id="pf-location" label="Office location">
                  <input id="pf-location" className="input" placeholder="Business Bay, Dubai" {...text('location')} />
                </Field>}
              </div>
            </div>
          </section>

          {/* 4 LISTINGS */}
          <section className="card p-5 sm:p-7" hidden={tab !== 'listings'}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="h3">{agencyAccount ? 'Agency properties' : 'Portfolio listings'}</h2>
                <p className="mt-1 text-[13px] text-muted">
                  {agencyAccount ? 'Choose which of your published properties are visible and featured on the agency portfolio.' : 'Choose what appears on your portfolio. These switches apply immediately.'}
                </p>
              </div>
              <Link className="btn btn-outline btn-sm" href="/listings">
                <Icon name="buildings" />
                Manage listings
              </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field id="pf-sort" label="Default property sorting">
                <select id="pf-sort" className="select" {...text('defaultSort')}>
                  <option value="featured">Most relevant (featured first)</option>
                  <option value="newest">Newest first</option>
                  <option value="priceDesc">Price: high to low</option>
                  <option value="priceAsc">Price: low to high</option>
                </select>
              </Field>
              <Toggle
                id="pf-closed"
                className="rounded-lg border border-line p-3"
                label="Show sold & rented history"
                description="Adds a “Sold & rented” tab to your portfolio."
                checked={D.showClosed !== false}
                onChange={(v) => update('showClosed', v)}
              />
            </div>
            <div className="mt-6">
              <h3 className="text-[14px] font-semibold text-ink">
                Featured order <span className="font-normal text-muted">(portfolio highlights)</span>
              </h3>
              <ol className="mt-2 space-y-1.5">
                {order.length ? (
                  order.map((id, i) => {
                    const l = feats.find((x) => x.id === id);
                    return (
                      <li key={id} className="flex items-center gap-3 rounded border border-line bg-white px-3 py-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mist text-2xs font-semibold">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{l.title}</span>
                        <button
                          type="button"
                          className="btn btn-ghost h-7 w-7 px-0"
                          aria-label="Move up"
                          disabled={!i}
                          onClick={() => move(i, -1)}
                        >
                          <Icon name="arrow-up" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost h-7 w-7 px-0"
                          aria-label="Move down"
                          disabled={i >= order.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <Icon name="arrow-down" />
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="text-[13px] text-muted">No featured listings. Use the star in the table below.</li>
                )}
              </ol>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Status</th>
                    <th className="text-center">Shown publicly</th>
                    <th className="text-center">Featured</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => {
                    const pub = l.status === 'published';
                    const hist = l.status === 'sold' || l.status === 'rented';
                    const st = STATUS[l.status] || STATUS.draft;
                    return (
                      <tr key={l.id}>
                        <td>
                          <Link className="flex items-center gap-3" href={routes.listing(l.id)}>
                            <img src={photoOf(l)} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                            <span className="min-w-0">
                              <span className="block max-w-[260px] truncate font-semibold text-ink">
                                {l.title || 'Untitled'}
                              </span>
                              <span className="block text-2xs text-muted">{l.area || ''}</span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <span className={'badge ' + st.cls}>{st.label}</span>
                        </td>
                        <td className="text-center">
                          {pub || hist ? (
                            <label className="inline-flex">
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={l.display.visible !== false}
                                onChange={(e) => setVisible(l.id, e.target.checked)}
                                aria-label={'Show ' + l.title + ' publicly'}
                              />
                              <span className="toggle" aria-hidden="true" />
                            </label>
                          ) : (
                            <span className="text-2xs text-muted">Not published</span>
                          )}
                        </td>
                        <td className="text-center">
                          {pub ? (
                            <button
                              type="button"
                              className="btn btn-ghost h-8 w-8 px-0"
                              aria-pressed={!!l.display.portfolioFeatured}
                              aria-label={(l.display.portfolioFeatured ? 'Unfeature ' : 'Feature ') + l.title}
                              onClick={() => toggleFeatured(l.id)}
                            >
                              <Icon name={l.display.portfolioFeatured ? 'star-fill' : 'star'} className="h-4 w-4" />
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5 VISIBILITY */}
          <section className="card p-5 sm:p-7" hidden={tab !== 'visibility'}>
            <h2 className="h3">Visibility &amp; sharing</h2>
            <p className="mt-1 text-[13px] text-muted">Control who can find your {agencyAccount ? 'agency page' : 'portfolio'} and how you share it.</p>
            <div className="mt-6 divide-y divide-line rounded-lg border border-line">
              <Toggle
                id="pf-public"
                className="p-4"
                label="Public profile"
                description="When off, your portfolio and listings can’t be opened by buyers."
                checked={D.isPublic !== false}
                onChange={(v) => update('isPublic', v)}
              />
              <Toggle
                id="pf-search"
                className="p-4"
                label="Show in Find an Agent"
                description={agencyAccount ? 'List your agency portfolio in public agency and property search results.' : 'List your profile in the public agent directory and search.'}
                checked={D.searchable !== false}
                onChange={(v) => update('searchable', v)}
              />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className={cx('field', err.slug && 'invalid')}>
                <label className="label" htmlFor="pf-slug">
                  Profile URL
                </label>
                <div className="flex items-stretch">
                  <span className="flex items-center rounded-l border border-r-0 border-line bg-mist px-3 text-[13px] text-muted">
                    /brokers/
                  </span>
                  <input
                    id="pf-slug"
                    className="input rounded-l-none"
                    maxLength={60}
                    value={D.slug || ''}
                    onChange={(e) => {
                      clearErr('slug');
                      update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    }}
                    aria-describedby={err.slug ? 'pf-slug-err pf-slug-hint' : 'pf-slug-hint'}
                    aria-invalid={err.slug ? 'true' : undefined}
                  />
                </div>
                <p className="hint" id="pf-slug-hint">
                  Lowercase letters, numbers and hyphens. Once published, your portfolio opens at{' '}
                  <span className="font-mono text-[12px]">/brokers/{D.slug || ''}</span>.
                </p>
                {err.slug && (
                  <p className="err" id="pf-slug-err" role="alert">
                    <Icon name="exclamation-circle" className="h-3.5 w-3.5" />
                    <span>{err.slug}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline" onClick={copyProfile}>
                  <Icon name="link-45deg" />
                  Copy link
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => share(currentUser().portfolio.displayName + ' on Emirate08', profilePath, toast)}
                >
                  <Icon name="share" />
                  Share
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Portfolio preview (iframe of the real public page, draft mode) */}
      <Modal
        open={pv.open}
        onClose={() => setPv({ ...pv, open: false })}
        labelledBy="pfpv-title"
        panelClassName="modal-xl flex h-[94vh] flex-col overflow-hidden sm:h-[92vh]"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 id="pfpv-title" className="h4">
            Portfolio preview
          </h2>
          <span className="badge badge-warn">Includes unpublished changes</span>
          <div className="seg ml-auto" role="group" aria-label="Viewport">
            {['desktop', 'mobile'].map((v) => (
              <button key={v} type="button" aria-pressed={pv.vp === v} onClick={() => openPreview(v)}>
                {v === 'desktop' ? 'Desktop' : 'Mobile'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost h-9 w-9 px-0"
            onClick={() => setPv({ ...pv, open: false })}
            aria-label="Close preview"
          >
            <Icon name="x-lg" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-mist p-2 sm:p-4">
          <div className="pv-frame h-full" data-vp={pv.vp}>
            <iframe
              key={pv.t}
              title="Portfolio preview"
              className="block h-full w-full bg-paper"
              src={'/brokers/me?preview=draft&embed=1&t=' + pv.t}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3 sm:px-5">
          <button type="button" className="btn btn-ghost" onClick={() => setPv({ ...pv, open: false })}>
            Back to editing
          </button>
          {publishBtn()}
        </div>
      </Modal>
    </div>
  );
}
