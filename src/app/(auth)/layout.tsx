import { ROLE_SCRIPT, SiteProviders, metadata, siteHtmlClassName, viewport } from '../SiteDocument';

export { metadata, viewport };

/** Sign-in, registration and password reset: no site chrome. */
export default function AuthLayout({ children }) {
  return (
    <html lang="en" className={siteHtmlClassName} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} /></head>
      <body className="bg-paper font-sans text-ink antialiased">
    <SiteProviders>
      <main id="main">{children}</main>
    </SiteProviders>
      </body>
    </html>
  );
}
