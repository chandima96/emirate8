import { ROLE_SCRIPT, SiteProviders, metadata, siteHtmlClassName, viewport } from '../SiteDocument';

export { metadata, viewport };

export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={siteHtmlClassName} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} />
      </head>
      <body className="bg-paper font-sans text-ink antialiased">
        <SiteProviders>{children}</SiteProviders>
      </body>
    </html>
  );
}
