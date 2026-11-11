import { MarketHeader } from '@/components/layout/MarketHeader';
import Script from 'next/script';
import { QuickRail } from '@/components/layout/QuickRail';
import { MarketFooter } from '@/components/layout/MarketFooter';
import { ROLE_SCRIPT, SiteProviders, metadata, siteHtmlClassName, viewport } from '../SiteDocument';

export { metadata, viewport };

/** Public portal: mega-menu header, role-based left rail (signed-in users only) and footer. */
export default function PortalLayout({ children }) {
  return (
    <html lang="en" className={siteHtmlClassName} suppressHydrationWarning>
      <head><Script id="embed-role-class" strategy="beforeInteractive">{ROLE_SCRIPT}</Script></head>
      <body className="bg-paper font-sans text-ink antialiased">
    <SiteProviders>
      <MarketHeader />
      <QuickRail />
      <div className="mkt-shell">
        <main id="main">{children}</main>
        <MarketFooter />
      </div>
    </SiteProviders>
      </body>
    </html>
  );
}
