'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Dropdown } from '@/components/ui/Dropdown';
import { LogoMark, Wordmark } from './Wordmark';
import { useSession } from '@/components/providers/SessionProvider';

const item = 'block rounded px-3 py-2 text-[14px] hover:bg-mist';

export function ProHeader() {
  const { ready, user } = useSession();
  return (
    <>
      <div className="border-b border-line bg-white text-[13px]">
        <div className="wrap flex h-9 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
            <Icon name="chevron-left" className="h-3.5 w-3.5" />
            Emirate08 Home
          </Link>
          {ready && user ? (
            <Link href="/dashboard" className="font-semibold text-ink hover:underline">
              Open workspace
            </Link>
          ) : (
            <Link href="/login" className="font-semibold text-ink hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
        <div className="wrap flex h-16 items-center gap-6">
          <Link
            href="/for-professionals"
            className="inline-flex items-center gap-2 text-ink"
            aria-label="Emirate08 for Professionals"
          >
            <LogoMark />
            <span className="font-display text-[18px] font-semibold tracking-[-0.02em]">
              Emirate<span className="f font-normal">08</span>
            </span>
            <span className="ml-1 hidden border-l border-line pl-2.5 text-2xs font-semibold tracking-[.12em] text-muted uppercase sm:inline">
              For professionals
            </span>
          </Link>
          <nav className="hidden items-center md:flex" aria-label="Professional">
            <Dropdown
              align="left"
              button={(p) => (
                <button type="button" className="hdr-link h-16" {...p}>
                  Who we serve
                  <Icon name="chevron-down" className="h-3.5 w-3.5" />
                </button>
              )}
            >
              <a className={item} href="#accounts">
                Individual brokers
              </a>
              <a className={item} href="#brokerage">
                Brokerage teams
              </a>
              <a className={item} href="#accounts">
                Real estate agencies
              </a>
            </Dropdown>
            <Dropdown
              align="left"
              button={(p) => (
                <button type="button" className="hdr-link h-16" {...p}>
                  Resources
                  <Icon name="chevron-down" className="h-3.5 w-3.5" />
                </button>
              )}
            >
              <a className={item} href="#profile">
                Agent profile guide
              </a>
              <a className={item} href="#listings">
                Listing management
              </a>
              <Link className={item} href="/platform">
                Platform overview
              </Link>
              <Link className={item} href="/help#contact">
                Account support
              </Link>
            </Dropdown>
          </nav>
          <Link href="/help#contact" className="btn btn-dark btn-sm ml-auto h-9">
            Contact us
          </Link>
        </div>
      </header>
    </>
  );
}

const cols: [string, [string, string][]][] = [
  [
    'For agents',
    [
      ['Agent profiles', '#profile'],
      ['Listings', '#listings'],
      ['Create an account', '/register?type=broker'],
    ],
  ],
  [
    'For agencies',
    [
      ['Team profiles', '#brokerage'],
      ['Agency accounts', '/register?type=agency'],
      ['Plans', '#accounts'],
    ],
  ],
  [
    'Resources',
    [
      ['Platform overview', '/platform'],
      ['Agent directory', '/agents'],
      ['Help & FAQs', '/help'],
    ],
  ],
  [
    'Support',
    [
      ['Contact us', '/help#contact'],
      ['Sign in', '/login'],
      ['Reset password', '/forgot-password'],
    ],
  ],
];

export function ProFooter() {
  return (
    <footer className="bg-white">
      <div className="wrap grid gap-10 border-t border-line py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <Wordmark href="/for-professionals" />
          <p className="mt-3 text-[13px] text-muted">For licensed brokers, teams and agencies in the UAE.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 md:col-span-8">
          {cols.map(([title, links]) => (
            <div key={title}>
              <p className="text-[14px] font-semibold text-ink">{title}</p>
              <ul className="mt-3 space-y-2 text-[14px]">
                {links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                      href={href}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="wrap flex flex-col gap-2 border-t border-line py-5 text-2xs text-muted sm:flex-row sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Emirate08. All rights reserved.</p>
        <p className="flex gap-4">
          <Link className="hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="hover:underline" href="/terms">
            Terms of Service
          </Link>
        </p>
      </div>
    </footer>
  );
}
