import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { HeroSearch } from '@/components/portal/HeroSearch';
import { RecentListings } from '@/components/portal/RecentListings';
import { BudgetExplorer } from '@/components/portal/BudgetExplorer';
import { QueryToasts } from '@/components/portal/QueryToasts';
import { IMG } from '@/config/images';

export const metadata = {
  title: { absolute: 'Emirate08 — Find Property and Real Estate Agents in Dubai' },
  description:
    'Search homes for sale and rent across Dubai, discover verified brokers and agencies, and save the listings you love.',
};

const POPULAR = ['Dubai Marina', 'Downtown Dubai', 'Palm Jumeirah', 'Dubai Hills Estate'];

const PATHS = [
  {
    icon: 'house-door',
    title: 'Buy a home',
    text: 'Browse ready and off-plan homes with photos, sizes, permits and the broker behind each listing.',
    href: '/properties?purpose=sale',
    cta: 'Browse homes',
  },
  {
    icon: 'key',
    title: 'Rent a home',
    text: 'Filter annual rentals by community, bedrooms and budget, then message the listing broker directly.',
    href: '/properties?purpose=rent',
    cta: 'Find rentals',
  },
  {
    icon: 'tag',
    title: 'Sell a home',
    text: 'Read the selling guide and find a broker who already lists in your community.',
    href: '/sell',
    cta: 'See your options',
  },
];

const COMMUNITIES = [
  ['Dubai Marina', 'dubai-marina'],
  ['Downtown Dubai', 'downtown-aerial'],
  ['Palm Jumeirah', 'palm-jumeirah'],
  ['Business Bay', 'business-bay'],
];

const q = (v) => '/properties?q=' + encodeURIComponent(v);

export default function HomePage() {
  return (
    <div>
      <QueryToasts />
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-ink-deep" aria-labelledby="hero-title">
        <img
          src={IMG + 'hero-dubai.webp'}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80"
          width="1920"
          height="1328"
          fetchPriority="high"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-deep/70 via-ink-deep/45 to-ink-deep/70" />
        <div className="wrap flex min-h-[460px] flex-col items-center justify-center py-16 text-center sm:min-h-[540px]">
          <h1
            id="hero-title"
            className="font-display text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-white sm:text-[52px] lg:text-[60px]"
          >
            Find the right place <em className="f font-normal">in Dubai.</em>
          </h1>
          <p className="mt-4 max-w-[520px] text-[15px] leading-[1.6] text-white/85 sm:text-[17px]">
            Homes for sale and rent, listed by licensed brokers you can look up.
          </p>
          <div className="mt-8 w-full max-w-[640px]">
            <HeroSearch />
            <p className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-white/80">
              Popular:
              {POPULAR.map((p) => (
                <Link key={p} href={q(p)} className="font-semibold text-white underline-offset-4 hover:underline">
                  {p}
                </Link>
              ))}
            </p>
          </div>
        </div>
      </section>

      <RecentListings />
      <BudgetExplorer />

      {/* BUY / RENT / SELL */}
      <section className="pb-16 sm:pb-20" aria-labelledby="paths-title">
        <div className="wrap">
          <h2 id="paths-title" className="sr-only">
            Buy, rent or sell
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PATHS.map((p) => (
              <article key={p.title} className="acard flex flex-col items-center p-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mist">
                  <Icon name={p.icon} className="h-7 w-7 text-ink" />
                </span>
                <h3 className="h4 mt-5">{p.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-[1.6] text-muted">{p.text}</p>
                <Link href={p.href} className="btn btn-outline mt-6">
                  {p.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* AGENT CTA */}
      <section className="pb-16 sm:pb-20" aria-labelledby="agent-cta">
        <div className="wrap">
          <div className="grid overflow-hidden rounded-lg bg-ink lg:grid-cols-2">
            <div className="on-dark flex flex-col justify-center p-8 sm:p-12">
              <p className="eyebrow text-white/70">Find an agent</p>
              <h2 id="agent-cta" className="h3 mt-3 text-white">
                Work with a broker who knows the community
              </h2>
              <p className="mt-3 max-w-[440px] text-[14px] leading-[1.6] text-[#A9B4B1]">
                Every profile shows the broker’s registration number, agency, languages and current listings.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/agents" className="btn btn-light">
                  Find an agent
                </Link>
                <Link href="/agents?view=agencies" className="btn btn-outline-light">
                  Browse agencies
                </Link>
              </div>
            </div>
            <img
              src={IMG + 'downtown-dubai.webp'}
              alt="Downtown Dubai skyline at dusk"
              className="h-64 w-full object-cover lg:h-full"
              loading="lazy"
              width="1280"
              height="853"
            />
          </div>
        </div>
      </section>

      {/* COMMUNITIES */}
      <section className="pb-16 sm:pb-20" aria-labelledby="comm-title">
        <div className="wrap">
          <p className="eyebrow">Explore communities</p>
          <h2 id="comm-title" className="h3 mt-3">
            Start with a neighbourhood
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {COMMUNITIES.map(([name, img]) => (
              <Link
                key={name}
                href={q(name)}
                className="group relative block aspect-[4/5] overflow-hidden rounded-lg bg-mist sm:aspect-[4/3]"
              >
                <img
                  src={IMG + img + '.webp'}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-ink-deep/70 to-transparent" />
                <span className="absolute bottom-3 left-3 font-display text-[16px] font-semibold text-white sm:text-[18px]">
                  {name}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-muted">
            All listings, brokers and agencies on this site are sample data for demonstration.
          </p>
        </div>
      </section>
    </div>
  );
}
