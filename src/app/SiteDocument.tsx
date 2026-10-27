import localFont from 'next/font/local';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import './globals.css';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { FeedbackProvider } from '@/components/providers/FeedbackProvider';
import { EnquiryProvider } from '@/components/providers/EnquiryProvider';

const instrument = localFont({
  src: '../fonts/instrument-sans-latin-wght-normal.woff2',
  variable: '--font-instrument',
  weight: '400 700',
  display: 'swap',
});
const interTight = localFont({
  src: '../fonts/inter-tight-latin-wght-normal.woff2',
  variable: '--font-inter-tight',
  weight: '400 800',
  display: 'swap',
});
const fraunces = localFont({
  src: '../fonts/fraunces-latin-wght-italic.woff2',
  variable: '--font-fraunces',
  style: 'italic',
  weight: '300 600',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Emirate08 — Dubai properties from independent brokers',
    template: '%s · Emirate08',
  },
  description:
    'Search Dubai properties for sale and rent, browse broker portfolios and contact licensed independent brokers.',
};

export const viewport = { themeColor: '#142326' };

const ROLE_SCRIPT = `(function(){if(/[?&]embed=1/.test(location.search))document.documentElement.classList.add('is-embed');})();`;

export const siteHtmlClassName = `${instrument.variable} ${interTight.variable} ${fraunces.variable}`;

export function SiteProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <SessionProvider>
        <FeedbackProvider>
          <EnquiryProvider>{children}</EnquiryProvider>
        </FeedbackProvider>
      </SessionProvider>
    </>
  );
}

export { ROLE_SCRIPT };
