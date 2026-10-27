import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Wordmark } from './Wordmark';
import { FOOTER_COLUMNS } from '@/config/navigation';

export function MarketFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="wrap grid gap-10 py-14 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Wordmark />
          <p className="mt-4 max-w-xs text-[13px] leading-[1.65] text-muted">
            Dubai property, listed by licensed brokers and agencies.
          </p>
          <ul className="mt-5 space-y-1.5 text-[13px] text-text">
            <li className="flex items-center gap-2">
              <Icon name="envelope" className="h-4 w-4 text-muted" />
              <Link href="/help#contact" className="hover:underline">
                Contact our team
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <Icon name="geo-alt" className="h-4 w-4 text-muted" />
              Dubai, United Arab Emirates
            </li>
          </ul>
          <div className="mt-5 flex gap-2" aria-label="Social media">
            {[
              ['instagram', 'Instagram'],
              ['linkedin', 'LinkedIn'],
              ['youtube', 'YouTube'],
            ].map(([icon, label]) => (
              <Link key={icon} className="social" href="/help#social" aria-label={label + ' (link to be confirmed)'}>
                <Icon name={icon} className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-9">
          {FOOTER_COLUMNS.map(([title, links]) => (
            <div key={title}>
              <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">{title}</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                {links.map(([label, href]) => (
                  <li key={label}>
                    <Link className="text-text hover:text-ink hover:underline" href={href}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="wrap flex flex-col gap-2 py-5 text-2xs text-muted md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Emirate08. Listings and professionals shown are sample records; photos are
            illustrative.
          </p>
          <p>
            Photography via Wikimedia Commons · Map data &copy; OpenStreetMap contributors ·{' '}
            <Link className="underline" href="/terms#credits">
              Credits
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
