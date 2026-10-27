import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { IMG } from '@/config/images';

export const metadata = {
  title: { absolute: 'Emirate08 for Professionals — Profiles and Listings for UAE Brokers' },
  description:
    'Create a verified broker or agency profile, publish listings and receive enquiries from buyers and tenants on Emirate08.',
};

const ACCOUNTS = [
  {
    icon: 'person',
    title: 'Individual broker',
    text: 'Your own verified profile, listings and enquiries.',
    items: ['Public broker profile', 'Listing manager', 'Enquiries inbox'],
    href: '/register?type=broker&plan=broker-bronze',
    cta: 'Join as a broker',
    cls: 'btn-dark',
  },
  {
    icon: 'people',
    title: 'Brokerage team',
    text: 'A small team sharing one agency profile and inventory.',
    items: ['Everything for brokers', 'Team members under one agency', 'Shared listings'],
    href: '/register?type=agency&plan=agency-silver',
    cta: 'Set up a team',
    cls: 'btn-outline',
  },
  {
    icon: 'buildings',
    title: 'Real estate agency',
    text: 'A full agency profile with ORN and every broker listed.',
    items: ['Agency public profile', 'Broker directory listing', 'Network collaboration'],
    href: '/register?type=agency&plan=agency-gold',
    cta: 'Register an agency',
    cls: 'btn-outline',
  },
];

export default function ForProfessionalsPage() {
  return (
    <>
      {/* HERO */}
      <section className="grid lg:grid-cols-[60fr_40fr]" aria-labelledby="pro-h">
        <div className="on-dark flex flex-col justify-center bg-ink px-4 py-14 sm:px-10 sm:py-20 lg:px-16 xl:px-24">
          <p className="eyebrow">Emirate08 for professionals</p>
          <h1
            id="pro-h"
            className="mt-5 max-w-[640px] font-display text-[36px] leading-[1.06] font-semibold tracking-[-0.03em] text-white sm:text-[52px]"
          >
            Be the broker buyers <em className="f font-normal">find first.</em>
          </h1>
          <p className="mt-5 max-w-[520px] text-[16px] leading-[1.65] text-[#A9B4B1]">
            A verified public profile, listings that show your name, and enquiries that land in one workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register?type=broker" className="btn btn-light btn-lg">
              Create a broker profile
            </Link>
            <Link href="/register?type=agency" className="btn btn-outline-light btn-lg">
              Register an agency
            </Link>
          </div>
          <p className="mt-6 text-[13px] text-[#A9B4B1]">
            Already a member?{' '}
            <Link href="/login" className="font-semibold text-white underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
        <div className="relative min-h-[320px] bg-ink-deep">
          <img
            src={IMG + 'register-architecture.webp'}
            alt="Modern tower façade in Dubai"
            className="absolute inset-0 h-full w-full object-cover"
            width="1280"
            height="1600"
            fetchPriority="high"
          />
        </div>
      </section>

      {/* PROFILE */}
      <section id="profile" className="wrap scroll-mt-24 py-16 sm:py-20" aria-labelledby="f1">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="pro-panel">
            <div className="mock w-full max-w-[400px] p-5">
              <div className="flex items-center gap-4">
                <span className="avatar h-14 w-14 shrink-0 bg-sage-soft text-[18px]">AR</span>
                <div className="min-w-0">
                  <p className="font-display text-[16px] font-semibold text-ink">Your name here</p>
                  <p className="text-[13px] text-muted">Your agency · Dubai Marina</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['English', 'Arabic', 'Apartments', 'Off-plan'].map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-mist pt-4 text-[12px] text-muted">
                <Icon name="patch-check-fill" className="h-4 w-4 text-ok" />
                BRN shown on your profile
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow">Public profile</p>
            <h2 id="f1" className="h2 mt-4">
              A profile built on credentials
            </h2>
            <p className="mt-4 max-w-[480px] text-[15px] leading-[1.7] text-muted">
              Show your BRN, agency, communities, languages and specialties. Buyers can read your bio, browse your
              active listings and message you from one page.
            </p>
            <Link href="/brokers/omar-haddad" className="tlink mt-6 inline-block">
              See a sample profile
            </Link>
          </div>
        </div>
      </section>

      {/* LISTINGS */}
      <section id="listings" className="scroll-mt-24 bg-white py-16 sm:py-20" aria-labelledby="f2">
        <div className="wrap grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="pro-panel lg:order-2">
            <div className="mock w-full max-w-[420px] divide-y divide-mist">
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[14px] font-semibold text-ink">Marina two-bedroom</p>
                  <p className="text-[12px] text-muted">Apartment · For sale</p>
                </div>
                <span className="badge badge-ok">
                  <span className="dot" />
                  Published
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[14px] font-semibold text-ink">Hills family villa</p>
                  <p className="text-[12px] text-muted">Villa · For sale</p>
                </div>
                <span className="badge badge-muted">Draft</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[14px] font-semibold text-ink">Business Bay office</p>
                  <p className="text-[12px] text-muted">Office · For rent</p>
                </div>
                <span className="badge badge-warn">Paused</span>
              </div>
            </div>
          </div>
          <div className="lg:order-1">
            <p className="eyebrow">Listing management</p>
            <h2 id="f2" className="h2 mt-4">
              Publish, pause and update in minutes
            </h2>
            <p className="mt-4 max-w-[480px] text-[15px] leading-[1.7] text-muted">
              A guided form checks photos, permit details and pricing before a listing goes live. Change status any time
              — buyers always see what’s current.
            </p>
            <Link href="/listings" className="tlink mt-6 inline-block">
              Open listing manager
            </Link>
          </div>
        </div>
      </section>

      {/* ENQUIRIES / BROKERAGE */}
      <section id="brokerage" className="wrap scroll-mt-24 py-16 sm:py-20" aria-labelledby="f3">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="pro-panel">
            <div className="mock w-full max-w-[400px] p-5">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold text-ink">Enquiries</p>
                <span className="badge badge-sage">New</span>
              </div>
              <div className="mt-4 rounded border border-mist p-3">
                <p className="text-[13px] font-semibold text-ink">Viewing request</p>
                <p className="mt-1 text-[12px] leading-[1.5] text-muted">
                  “Is the Marina apartment still available? I’d like to arrange a viewing.”
                </p>
              </div>
              <div className="mt-3 rounded border border-mist p-3">
                <p className="text-[13px] font-semibold text-ink">General enquiry</p>
                <p className="mt-1 text-[12px] leading-[1.5] text-muted">
                  “Looking for a three-bedroom rental in Dubai Hills.”
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow">Enquiries &amp; teams</p>
            <h2 id="f3" className="h2 mt-4">
              Every lead in one inbox
            </h2>
            <p className="mt-4 max-w-[480px] text-[15px] leading-[1.7] text-muted">
              Messages from your profile and listings arrive in your workspace. Agencies can bring their brokers under
              one profile and share opportunities across the network.
            </p>
            <Link href="/enquiries" className="tlink mt-6 inline-block">
              View the enquiries inbox
            </Link>
          </div>
        </div>
      </section>

      {/* ACCOUNT TYPES */}
      <section id="accounts" className="scroll-mt-24 bg-white py-16 sm:py-20" aria-labelledby="acc-h">
        <div className="wrap">
          <p className="eyebrow">Account types</p>
          <h2 id="acc-h" className="h2 mt-4 max-w-[560px]">
            Choose how you work
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {ACCOUNTS.map((a) => (
              <article key={a.title} className="acard flex flex-col p-7">
                <Icon name={a.icon} className="h-6 w-6 text-ink" />
                <h3 className="h4 mt-4">{a.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-[1.6] text-muted">{a.text}</p>
                <ul className="mt-5 space-y-2 text-[14px]">
                  {a.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <Icon name="check-lg" className="mt-0.5 h-4 w-4 shrink-0" />
                      {it}
                    </li>
                  ))}
                </ul>
                <Link href={a.href} className={'btn mt-7 ' + a.cls}>
                  {a.cta}
                </Link>
              </article>
            ))}
          </div>
          <p className="mt-6 text-[13px] text-muted">
            Compare membership plans on the{' '}
            <Link className="link" href="/platform#membership">
              platform overview
            </Link>
            .
          </p>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="on-dark bg-ink" aria-labelledby="cta-h">
        <div className="wrap flex flex-col items-start justify-between gap-6 py-14 sm:py-16 md:flex-row md:items-center">
          <div>
            <h2 id="cta-h" className="h2 text-white">
              Ready when you are
            </h2>
            <p className="mt-2 text-[15px] text-[#A9B4B1]">
              Registration takes a few minutes. Try the demo workspace first if you like.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-light btn-lg">
              Get started
            </Link>
            <Link href="/login" className="btn btn-outline-light btn-lg">
              Try the demo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
