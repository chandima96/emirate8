import { ROLE_SCRIPT, metadata, siteHtmlClassName, viewport } from '../SiteDocument';

export { metadata, viewport };

export default function ControlRoomLayout({ children }) {
  return (
    <html lang="en" className={siteHtmlClassName} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} /></head>
      <body className="bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
