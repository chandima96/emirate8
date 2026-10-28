import { MarketHeader } from '@/components/layout/MarketHeader';
import { MarketFooter } from '@/components/layout/MarketFooter';
import { ROLE_SCRIPT, SiteProviders, metadata, siteHtmlClassName, viewport } from '../SiteDocument';

export { metadata, viewport };

/** Full-width public pages (platform overview, legal):header and footer without the shortcut rail. */
export default function SiteLayout({ children }) {
  return (
    <html lang="en" className={siteHtmlClassName} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} /></head>
      <body className="bg-paper font-sans text-ink antialiased">
    <SiteProviders>
      <MarketHeader />
      <main id="main" className="pt-(--header-h)">
        {children}
      </main>
      <MarketFooter />
    </SiteProviders>
      </body>
    </html>
  );
}
