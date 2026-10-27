'use client';

import { joinWaitlistAction } from '@/app/actions';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { RX, cx } from '@/lib/utils';
import { IMG, PIMG } from '@/config/images';
import { DubaiMap } from './DubaiMap';
import { WorkspacePreview } from './WorkspacePreview';
import { usePlatformMotion } from './usePlatformMotion';
import { useStoreVersion } from '@/hooks/useStore';
import { plans } from '@/lib/store';

const TRUST = [
  ['shield-check', 'Professional Verification', 'Broker credentials are reviewed before publishing.', 'sm:pr-6'],
  ['layers', 'Organised Listings', 'Manage property information, media, and availability.', 'sm:pl-6'],
  ['diagram-3', 'Connected Network', 'Discover opportunities from participating brokers.', 'sm:pr-6 lg:pl-6'],
  ['sliders', 'Flexible Membership', 'Choose a plan that supports your business.', 'sm:pl-6'],
];

const STEPS = [
  {
    n: '01',
    icon: 'person-plus',
    title: 'Register Your Business',
    text: 'Create your account as a licensed broker or real estate agency and submit the required professional credentials.',
    link: ['/register', 'Start registration'],
  },
  {
    n: '02',
    icon: 'buildings',
    title: 'Manage Your Properties',
    text: 'Add sale and rental listings, upload images, manage property information, and keep availability up to date.',
    link: ['#workspace', 'See the workspace'],
  },
  {
    n: '03',
    icon: 'people',
    title: 'Connect with Other Brokers',
    text: 'Discover network properties, select opportunities of interest, and contact the listing professionals directly.',
    link: ['#membership', 'Compare plans'],
  },
];

const LOC = {
  downtown: {
    n: '01',
    name: 'Downtown Dubai',
    img: IMG + 'downtown-dubai.webp',
    alt: 'Burj Khalifa and the towers of Downtown Dubai seen from above',
    desc: 'A central urban destination recognised for landmark architecture, residential towers, and vibrant city living.',
  },
  marina: {
    n: '02',
    name: 'Dubai Marina',
    img: IMG + 'dubai-marina.webp',
    alt: 'Dubai Marina skyline reflected across the water',
    desc: 'A waterfront district known for modern high-rise residences, marina promenades, and lifestyle destinations.',
  },
  palm: {
    n: '03',
    name: 'Palm Jumeirah',
    img: IMG + 'palm-jumeirah.webp',
    alt: 'Palm Jumeirah fronds seen from above with the Dubai coastline behind',
    desc: 'An iconic waterfront address featuring beachfront residences, premium apartments, and villa communities.',
  },
  businessbay: {
    n: '04',
    name: 'Business Bay',
    img: IMG + 'business-bay.webp',
    alt: 'Business Bay towers along Dubai Water Canal at sunset',
    desc: 'A dynamic business and residential district combining modern offices, high-rise apartments, and convenient city connections.',
  },
  hills: {
    n: '05',
    name: 'Dubai Hills Estate',
    img: IMG + 'dubai-hills.webp',
    alt: 'Palm trees and a lake at sunset in Dubai Hills',
    desc: 'A master-planned community offering modern homes, landscaped open spaces, and family-friendly surroundings.',
  },
};
const LOC_ORDER = ['downtown', 'marina', 'palm', 'businessbay', 'hills'];

const WHY = [
  [
    'person-vcard',
    'Your Professional Presence',
    'Maintain your brokerage details, professional credentials, service areas, languages, and profile information in one place.',
  ],
  [
    'clipboard-check',
    'Smarter Property Management',
    'Create, update, organise, and monitor residential and commercial listings across your portfolio.',
  ],
  [
    'diagram-3',
    'A Connected Broker Network',
    'Explore properties represented by other brokers and communicate directly with the relevant listing professional.',
  ],
  [
    'people',
    'Support for Growing Teams',
    'Choose a membership that supports independent agents, growing agencies, and larger organisations.',
  ],
];

const COMMUNITIES = [
  {
    k: 'downtown',
    img: 'downtown-aerial.webp',
    alt: 'Aerial view of Downtown Dubai towers and road network',
    w: 1300,
    h: 975,
    name: 'Downtown Dubai',
    tag: 'Landmark city living',
  },
  {
    k: 'marina',
    img: 'dubai-marina.webp',
    alt: 'Dubai Marina skyline reflected across the water',
    w: 1300,
    h: 867,
    name: 'Dubai Marina',
    tag: 'Waterfront high-rise living',
  },
  {
    k: 'palm',
    img: 'palm-jumeirah.webp',
    alt: 'Palm Jumeirah fronds seen from above with the Dubai coastline behind',
    w: 1300,
    h: 703,
    name: 'Palm Jumeirah',
    tag: 'Iconic island residences',
    cls: 'object-[40%_50%]',
  },
  {
    k: 'hills',
    img: 'dubai-hills.webp',
    alt: 'Palm trees and a lake at sunset in Dubai Hills',
    w: 1300,
    h: 2309,
    name: 'Dubai Hills Estate',
    tag: 'Master-planned green living',
  },
];

/** Platform overview (old platform.html + home.js + animations.js). */
export function PlatformPage() {
  const rootRef = useRef(null);
  const { toast } = useFeedback();
  usePlatformMotion(rootRef);
  useStoreVersion();
  const planCards = Object.values(plans()).map((plan) => ({
    ...plan,
    href: `/register?plan=${plan.id}${plan.roleAudience && plan.roleAudience !== 'platform' ? `&type=${plan.roleAudience}` : ''}`,
    cta: plan.id === 'enterprise' ? 'Explore Enterprise' : `Choose ${plan.name}`,
    dark: plan.highlighted,
  }));

  /* Map + community panel with a crossfade */
  const [loc, setLoc] = useState('downtown');
  const [shown, setShown] = useState('downtown');
  const [out, setOut] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    LOC_ORDER.forEach((k) => {
      const im = new Image();
      im.src = LOC[k].img;
    }); // warm cache for crossfades
    return () => clearTimeout(timer.current);
  }, []);
  const showLoc = (key) => {
    if (!LOC[key] || key === loc) return;
    setLoc(key);
    setOut(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setShown(key);
      setOut(false);
    }, 220);
  };
  const d = LOC[shown];

  /* Owner waitlist is stored in the Supabase-backed Payload collection. */
  const [wlEmail, setWlEmail] = useState('');
  const [wlError, setWlError] = useState('');
  const [wlDone, setWlDone] = useState(false);
  const wlRef = useRef(null);
  const [wlSubmitting, setWlSubmitting] = useState(false);
  const joinWaitlist = async (e) => {
    e.preventDefault();
    const value = wlEmail.trim();
    if (!RX.email.test(value)) {
      setWlError('Enter a valid email address, e.g. name@company.ae');
      wlRef.current?.focus();
      return;
    }
    setWlSubmitting(true);
    try {
      const result = await joinWaitlistAction({ email: value, role: 'other', source: 'homepage' });
      if (!result.ok) throw new Error(result.error || 'Could not join the waitlist.');
      setWlEmail('');
      setWlDone(true);
      toast('Added to the developer updates waitlist.');
    } catch (error) {
      setWlError(error instanceof Error ? error.message : 'Could not join the waitlist.');
    } finally {
      setWlSubmitting(false);
    }
  };

  /* Same-page anchors scroll smoothly below the fixed header (old navigation.js scrollToHash). */
  const onClick = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    const header = document.querySelector('.mkt-header');
    const offset = (header ? (header as HTMLElement).offsetHeight : 0) + 8;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
    history.pushState(null, '', a.getAttribute('href'));
  };

  return (
    <div ref={rootRef} onClick={onClick}>
      {/* 01 HERO */}
      <section id="top" className="relative" data-hero>
        <div className="wrap grid items-stretch gap-8 py-8 lg:min-h-[660px] lg:grid-cols-[45fr_55fr] lg:gap-14 lg:py-10">
          <div className="flex flex-col justify-center py-4 lg:py-10">
            <p className="eyebrow" data-hero-eyebrow>
              The UAE&apos;s Connected Real Estate Network
            </p>
            <h1 className="h1 mt-5 max-w-[560px]">
              <span className="line-mask" data-line>
                <span>Your Brokerage.</span>
              </span>
              <span className="line-mask" data-line>
                <span>
                  More <em className="f font-normal">Opportunities.</em>
                </span>
              </span>
              <span className="line-mask" data-line>
                <span>One Connected Platform.</span>
              </span>
            </h1>
            <p className="lead mt-5 max-w-[480px]" data-hero-fade>
              Create your professional broker profile, manage property listings, and discover opportunities across a
              growing network of real estate professionals — all from one streamlined workspace.
            </p>
            <div className="mt-7 flex flex-wrap gap-3" data-hero-cta>
              <Link href="/register" className="btn btn-dark btn-lg">
                Join as Broker
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
              <a href="#workspace" className="btn btn-outline btn-lg">
                Explore the Platform
              </a>
            </div>
            <div
              className="mt-8 flex items-center gap-3 border-t border-line pt-5 text-[13px] text-muted"
              data-hero-fade
            >
              <i className="bi bi-patch-check-fill h-[18px] w-[18px] shrink-0 text-ink" aria-hidden="true" />
              <p>Built for licensed brokers and real estate agencies across the UAE.</p>
            </div>
          </div>
          <div
            className="relative min-h-[340px] overflow-hidden rounded-lg bg-mist sm:min-h-[440px] lg:min-h-0"
            data-hero-frame
          >
            <img
              src={IMG + 'hero-dubai.webp'}
              alt="Residential towers and moored yachts in Dubai Marina on a clear day"
              className="img-cover absolute inset-0 scale-100 will-change-transform"
              style={{ height: '112%', top: '-6%' }}
              width="1920"
              height="1328"
              fetchPriority="high"
              data-hero-img
            />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-deep/40 to-transparent" />
            <div className="absolute right-4 bottom-4 left-4 flex flex-wrap items-end justify-between gap-3 sm:right-5 sm:bottom-5 sm:left-5">
              <div className="max-w-[280px] rounded-lg bg-white/95 p-3.5 shadow-card backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-2xs font-semibold tracking-[.1em] text-muted uppercase">Listing status</span>
                  <span className="badge badge-ok">
                    <span className="dot" />
                    Published
                  </span>
                </div>
                <p className="mt-2 font-display text-[14px] font-semibold text-ink">Two-bedroom residence</p>
                <p className="text-xs text-muted">Dubai Marina · Apartment · For sale</p>
              </div>
              <span className="demo-tag">Dubai Marina · Illustrative</span>
            </div>
          </div>
        </div>
      </section>

      {/* 02 TRUST STRIP */}
      <section aria-label="Platform principles" className="border-y border-line bg-white">
        <div
          className="wrap grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
          data-stagger
        >
          {TRUST.map(([icon, title, text, pad]) => (
            <div key={title} className={cx('flex gap-3.5 py-6 lg:py-7', pad)}>
              <i className={`bi bi-${icon} mt-0.5 h-5 w-5 shrink-0 text-ink`} aria-hidden="true" />
              <div>
                <h2 className="h4 text-[15px]">{title}</h2>
                <p className="mt-1 text-[13px] leading-[1.55] text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 03 HOW IT WORKS */}
      <section id="how-it-works" className="py-16 lg:py-[88px]">
        <div className="wrap">
          <div className="grid gap-5 lg:grid-cols-12 lg:items-end" data-reveal>
            <div className="lg:col-span-7">
              <p className="eyebrow">How It Works</p>
              <h2 className="h2 mt-4 max-w-[560px]">
                Three Steps to a More <em className="f font-normal">Connected</em> Brokerage.
              </h2>
            </div>
            <p className="lead lg:col-span-5 lg:pb-1">
              Create your account, organise your portfolio, and access a growing professional network.
            </p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-12 lg:gap-6" data-stagger>
            {STEPS.map((s) => (
              <li key={s.n} className="card group flex flex-col p-6 transition-colors hover:border-[#B8C3BE]">
                <div className="flex items-center justify-between">
                  <span className="f text-[26px] leading-none text-ink">{s.n}</span>
                  <i className={`bi bi-${s.icon} h-5 w-5 text-muted`} aria-hidden="true" />
                </div>
                <h3 className="h4 mt-8">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-muted">{s.text}</p>
                {s.link[0].startsWith('#') ? (
                  <a href={s.link[0]} className="arrow-link mt-auto pt-6">
                    {s.link[1]}
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </a>
                ) : (
                  <Link href={s.link[0]} className="arrow-link mt-auto pt-6">
                    {s.link[1]}
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 04 WORKSPACE */}
      <WorkspacePreview />

      {/* 05 MAP */}
      <section id="explore-dubai" className="bg-white py-16 lg:py-[88px]">
        <div className="wrap">
          <div className="grid gap-5 lg:grid-cols-12 lg:items-end" data-reveal>
            <div className="lg:col-span-7">
              <p className="eyebrow">Explore Dubai</p>
              <h2 className="h2 mt-4 max-w-[600px]">
                Find Your Place in Dubai&apos;s Most <em className="f font-normal">Recognised</em> Communities.
              </h2>
            </div>
            <p className="lead lg:col-span-5 lg:pb-1">
              Explore the locations shaping Dubai&apos;s residential and investment landscape.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              <div className="relative overflow-hidden rounded-lg border border-line bg-paper" data-map>
                <DubaiMap active={loc} onSelect={showLoc} />
                <p className="absolute top-3 left-3 rounded bg-white/90 px-2 py-1 text-2xs text-muted">
                  Central Dubai · coastline &amp; emirate boundary
                </p>
              </div>
              <p className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-2xs text-muted">
                <span>Select a marker to explore. Informational map — property search arrives in a later phase.</span>
                <span>Map data &copy; OpenStreetMap contributors (ODbL)</span>
              </p>
            </div>
            <div className="lg:col-span-5" aria-live="polite">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-mist">
                <img
                  src={d.img}
                  alt={d.alt}
                  className={cx('img-cover xfade', out && 'is-out')}
                  width="1300"
                  height="863"
                  loading="lazy"
                />
                <span className="demo-tag absolute top-3 left-3">
                  {d.n} / 05 · {d.name}
                </span>
              </div>
              <div className={cx('xfade', out && 'is-out')}>
                <h3 className="h3 mt-5">{d.name}</h3>
                <p className="mt-2 text-[14px] leading-[1.65] text-muted">{d.desc}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2" aria-label="Communities">
                {LOC_ORDER.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={cx('btn btn-sm', loc === k ? 'btn-dark' : 'btn-outline')}
                    aria-pressed={loc === k}
                    onClick={() => showLoc(k)}
                  >
                    {LOC[k].name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 06 WHY */}
      <section className="py-16 lg:py-[88px]">
        <div className="wrap grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4" data-reveal>
            <p className="eyebrow">Why Brokers Join</p>
            <h2 className="h2 mt-4">
              Built Around the Way You <em className="f font-normal">Work.</em>
            </h2>
            <div className="relative mt-8 hidden aspect-[4/5] overflow-hidden rounded-lg lg:block" data-img-reveal>
              <img
                src={PIMG + 'prop-meeting-room.webp'}
                alt="A bright meeting room with a wooden table and white chairs"
                className="img-cover"
                loading="lazy"
                width="1200"
                height="801"
              />
            </div>
          </div>
          <div className="grid border-t border-l border-line sm:grid-cols-2 lg:col-span-8 lg:self-end" data-stagger>
            {WHY.map(([icon, title, text]) => (
              <div key={title} className="border-r border-b border-line bg-white p-6 lg:p-8">
                <i className={`bi bi-${icon} h-5 w-5 text-ink`} aria-hidden="true" />
                <h3 className="h4 mt-6">{title}</h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 07 COMMUNITIES */}
      <section id="communities" className="border-t border-line bg-white py-16 lg:py-[88px]">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-5" data-reveal>
            <div>
              <p className="eyebrow">Dubai Communities</p>
              <h2 className="h2 mt-4 max-w-[560px]">
                Discover the Places Behind the <em className="f font-normal">Properties.</em>
              </h2>
            </div>
            <a href="#explore-dubai" className="arrow-link">
              Open the map
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </a>
          </div>
          <div
            className="-mx-4 mt-10 no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:mt-12 lg:grid-cols-4 lg:gap-5"
            data-stagger
          >
            {COMMUNITIES.map((c) => (
              <a
                key={c.k}
                href="#explore-dubai"
                onClick={() => showLoc(c.k)}
                className="group relative block aspect-[3/4] w-[72%] shrink-0 snap-start overflow-hidden rounded-lg bg-mist sm:w-auto"
              >
                <img
                  src={IMG + c.img}
                  alt={c.alt}
                  className={cx('img-cover zoom-img', c.cls)}
                  loading="lazy"
                  width={c.w}
                  height={c.h}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-deep/75 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
                  <div>
                    <h3 className="font-display text-[17px] font-semibold text-white">{c.name}</h3>
                    <p className="mt-0.5 text-xs text-white/80">{c.tag}</p>
                  </div>
                  <i
                    className="bi bi-arrow-up-right h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                    aria-hidden="true"
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 08 MEMBERSHIP */}
      <section id="membership" className="py-16 lg:py-[88px]">
        <div className="wrap">
          <div className="grid gap-5 lg:grid-cols-12 lg:items-end" data-reveal>
            <div className="lg:col-span-7">
              <p className="eyebrow">Membership Plans</p>
              <h2 className="h2 mt-4 max-w-[560px]">
                Choose the Right Fit for Your <em className="f font-normal">Brokerage.</em>
              </h2>
            </div>
            <p className="lead lg:col-span-5 lg:pb-1">
              Whether you&apos;re an independent agent or managing a team, Emirate08 offers a starting point for your
              digital brokerage workspace.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-12 lg:gap-5" data-stagger>
            {planCards.map((p) =>
              p.dark ? (
                <article key={p.name} className="on-dark relative flex flex-col rounded-lg bg-ink p-6 lg:p-7">
                  <span className="badge absolute top-6 right-5 bg-sage text-ink">For agencies</span>
                  <h3 className="h3">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-[#A9B4B1]">{p.audience}</p>
                  <p className="mt-6 border-y border-white/15 py-4 text-[13px] font-semibold text-white">
                    Pricing to be confirmed
                  </p>
                  <ul className="mt-5 space-y-2.5 text-[13px] text-[#DCE2DE]">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <i className="bi bi-check-lg mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={p.href} className="btn btn-sage mt-8 w-full">
                    {p.cta}
                  </Link>
                </article>
              ) : (
                <article key={p.name} className="card flex flex-col p-6 lg:p-7">
                  <h3 className="h3">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-muted">{p.audience}</p>
                  <p className="mt-6 border-y border-line py-4 text-[13px] font-semibold text-ink">
                    Pricing to be confirmed
                  </p>
                  <ul className="mt-5 space-y-2.5 text-[13px]">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <i className="bi bi-check-lg mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={p.href} className="btn btn-outline mt-8 w-full">
                    {p.cta}
                  </Link>
                </article>
              ),
            )}
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted">
            <i className="bi bi-info-circle h-3.5 w-3.5" aria-hidden="true" />
            Plan limits are provisional until confirmed. Every plan starts with a trial; no payment is taken during
            registration.
          </p>
        </div>
      </section>

      {/* 09 OWNER WAITLIST */}
      <section id="owners" className="border-y border-line bg-white">
        <div className="wrap grid gap-6 py-12 lg:grid-cols-12 lg:items-center lg:gap-8 lg:py-14">
          <div className="lg:col-span-6" data-reveal>
            <p className="eyebrow">Coming Soon</p>
            <h2 className="h3 mt-3 lg:text-[24px]">A Better Experience for Property Owners Is on the Way.</h2>
            <p className="mt-2 max-w-[520px] text-[14px] leading-[1.65] text-muted">
              Future owner services will make it easier to connect with real estate professionals. Join the waitlist to
              hear when they&apos;re available.
            </p>
          </div>
          <form className="lg:col-span-6" noValidate onSubmit={joinWaitlist} data-reveal>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className={cx('field flex-1', wlError && 'invalid')}>
                <label htmlFor="wl-email" className="sr-only">
                  Email address
                </label>
                <input
                  ref={wlRef}
                  id="wl-email"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="Your email address"
                  autoComplete="email"
                  required
                  value={wlEmail}
                  onChange={(e) => {
                    setWlEmail(e.target.value);
                    setWlError('');
                  }}
                  aria-invalid={wlError ? 'true' : undefined}
                  aria-describedby={wlError ? 'wl-email-err' : undefined}
                />
                {wlError && (
                  <p className="err" id="wl-email-err">
                    <i className="bi bi-exclamation-circle h-3.5 w-3.5" aria-hidden="true" />
                    <span>{wlError}</span>
                  </p>
                )}
              </div>
              <button type="submit" className="btn btn-dark btn-lg h-11" disabled={wlSubmitting}>
                {wlSubmitting ? 'Saving…' : 'Join Waitlist'}
              </button>
            </div>
            <p className="mt-2.5 text-2xs text-muted">
              {wlDone ? (
                <>
                  <span className="font-semibold text-ink">You’re on the list.</span> Your signup is saved securely.
                </>
              ) : (
                'Your email is saved securely so we can contact you when owner services launch.'
              )}
            </p>
          </form>
        </div>
      </section>

      {/* 10 FINAL CTA */}
      <section className="on-dark grid bg-ink-deep lg:grid-cols-2">
        <div
          className="flex flex-col justify-center px-4 py-16 sm:px-6 lg:py-[88px] lg:pr-14 lg:pl-[max(3rem,calc((100vw-1320px)/2+4rem))]"
          data-reveal
        >
          <p className="eyebrow">Join Emirate08</p>
          <h2 className="h2 mt-4 max-w-[480px]">
            The Next Step for Your Brokerage <em className="f font-normal text-sage">Starts Here.</em>
          </h2>
          <p className="lead mt-4 max-w-[460px]">
            Create your professional account and bring your property portfolio and broker connections into one modern
            workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-sage btn-lg">
              Create Your Account
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
            <Link href="/login" className="btn btn-outline-light btn-lg">
              Sign In
            </Link>
          </div>
        </div>
        <div className="relative h-[300px] overflow-hidden sm:h-[380px] lg:h-auto lg:min-h-[500px]">
          <img
            src={IMG + 'cta-dubai-dusk.webp'}
            alt="Dubai's towers lit up at dusk under a violet sky"
            className="absolute inset-x-0 h-[114%] w-full object-cover"
            style={{ top: '-7%' }}
            loading="lazy"
            width="1800"
            height="1013"
            data-parallax="4"
          />
        </div>
      </section>
    </div>
  );
}
