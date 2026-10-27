import { ProHeader, ProFooter } from '@/components/layout/ProChrome';
import { ROLE_SCRIPT, SiteProviders, metadata, siteHtmlClassName, viewport } from '../SiteDocument';

export { metadata, viewport };

/** Professional landing pages with their own header and footer. */
export default function ProLayout({ children }) {
  return (
    <html lang="en" className={siteHtmlClassName} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} /></head>
      <body className="bg-paper font-sans text-ink antialiased">
    <SiteProviders>
      <ProHeader />
      <main id="main">{children}</main>
      <ProFooter />
    </SiteProviders>
      </body>
    </html>
  );
}
