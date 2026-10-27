import { AppShell } from '@/components/workspace/AppShell';
import { ROLE_SCRIPT, SiteProviders, metadata, siteHtmlClassName, viewport } from '../SiteDocument';

export { metadata, viewport };

/** Broker workspace: guarded (guests → /unauthorized, buyers → /saved), sidebar and top bar. */
export default function WorkspaceLayout({ children }) {
  return (
    <html lang="en" className={siteHtmlClassName} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} /></head>
      <body className="bg-paper font-sans text-ink antialiased">
    <SiteProviders>
      <AppShell>{children}</AppShell>
    </SiteProviders>
      </body>
    </html>
  );
}
