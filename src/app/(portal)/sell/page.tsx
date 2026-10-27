import Link from 'next/link';
import { OwnerWaitlist } from '@/components/portal/OwnerWaitlist';
import { IMG } from '@/config/images';

export const metadata = {
  title: 'Sell Your Property in Dubai',
  description:
    'A practical guide to selling property in Dubai and how to find a broker who already lists in your community.',
};

const STEPS = [
  [
    '01',
    'Choose a broker',
    'Compare brokers who list in your community. Check their BRN and agency before you sign anything.',
  ],
  [
    '02',
    'Sign the listing agreement',
    'In Dubai this is usually Form A between you and the broker, setting terms and commission.',
  ],
  [
    '03',
    'Get the advertising permit',
    'Your broker applies for the permit so the property can be advertised legally, then prepares photos and the listing.',
  ],
  [
    '04',
    'Agree terms and transfer',
    'Once you accept an offer, buyer and seller sign the sale agreement and complete transfer at a trustee office.',
  ],
];

export default function SellPage() {
  return (
    <>
      <section className="border-b border-line bg-white" aria-labelledby="sell-h">
        <div className="wrap grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="eyebrow">Sell</p>
            <h1 id="sell-h" className="h1 mt-4">
              Selling in Dubai, <em className="f font-normal">step by step</em>
            </h1>
            <p className="lead mt-4 max-w-[520px]">
              Most sales in Dubai run through a licensed broker. Start by finding one who already lists in your
              community, then follow the guide below.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/agents" className="btn btn-dark btn-lg">
                Find a selling agent
              </Link>
              <a href="#guide" className="btn btn-outline btn-lg">
                Read the guide
              </a>
            </div>
          </div>
          <img
            src={IMG + 'dubai-hills.webp'}
            alt="Villas and green space in Dubai Hills Estate"
            className="aspect-[4/3] w-full rounded-lg object-cover"
            width="1280"
            height="960"
          />
        </div>
      </section>
      <section id="guide" className="wrap scroll-mt-24 py-12 sm:py-16" aria-labelledby="guide-h">
        <h2 id="guide-h" className="h2">
          The selling guide
        </h2>
        <p className="mt-2 max-w-[620px] text-[14px] text-muted">
          General information only — confirm current requirements and fees with your broker and the Dubai Land
          Department.
        </p>
        <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(([n, title, text]) => (
            <li key={n} className="acard p-6">
              <span className="font-display text-[13px] font-semibold text-muted">{n}</span>
              <h3 className="h4 mt-3">{title}</h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section id="waitlist" className="wrap scroll-mt-24 pb-16 sm:pb-20" aria-labelledby="wl-h">
        <div className="grid gap-8 rounded-lg bg-mist p-7 sm:p-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 id="wl-h" className="h3">
              Owner tools are coming
            </h2>
            <p className="mt-2 max-w-[460px] text-[14px] leading-[1.6] text-muted">
              We’re building a way for owners to share property details with brokers directly. Join the list to hear
              when it opens.
            </p>
          </div>
          <OwnerWaitlist />
        </div>
      </section>
    </>
  );
}
