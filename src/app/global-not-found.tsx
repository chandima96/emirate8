import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Wordmark } from '@/components/layout/Wordmark';
import { IMG } from '@/config/images';
import { siteHtmlClassName } from './SiteDocument';

export const metadata = {
  title: 'Page Not Found',
  description: 'The page you were looking for could not be found.',
};

const LINKS = [
  ['/register', 'Join as Broker'],
  ['/platform#membership', 'Membership plans'],
  ['/platform#explore-dubai', 'Explore Dubai'],
  ['/login', 'Sign in'],
];

/** 404 — plain layout without the site chrome. */
export default function NotFound() {
  return (
    <html lang="en" className={siteHtmlClassName}>
      <body className="bg-paper font-sans text-ink antialiased">
        <NotFoundContent />
      </body>
    </html>
  );
}

function NotFoundContent() {
  return (
    <main id="main">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
          <Wordmark className="self-start" />
          <div className="my-auto max-w-[460px] py-16">
            <p className="f text-[64px] leading-none text-ink">404</p>
            <h1 className="h2 mt-6">This address isn&apos;t on the map.</h1>
            <p className="mt-3 text-[14px] leading-[1.65] text-muted">
              The page may have moved, or the link may be incomplete. Try one of these instead.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/" className="btn btn-dark btn-lg">
                <Icon name="house-door" />
                Back to homepage
              </Link>
              <Link href="/dashboard" className="btn btn-outline btn-lg">
                Open workspace
              </Link>
            </div>
            <ul className="mt-10 grid gap-2 border-t border-line pt-6 text-[13px] sm:grid-cols-2">
              {LINKS.map(([href, label]) => (
                <li key={href}>
                  <Link className="arrow-link" href={href}>
                    {label}
                    <Icon name="arrow-right" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="relative hidden overflow-hidden bg-ink-deep lg:block">
          <img
            src={IMG + 'downtown-aerial.webp'}
            alt="Aerial view of Downtown Dubai"
            className="img-cover opacity-90"
            width="1300"
            height="975"
          />
        </div>
      </div>
    </main>
  );
}
