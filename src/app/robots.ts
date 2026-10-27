export default function robots() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return { rules: [{ userAgent: '*', allow: ['/'], disallow: ['/dashboard', '/agency-dashboard', '/developer-dashboard', '/account', '/control-room', '/api/', '/login', '/register', '/saved'] }], sitemap: `${base}/sitemap.xml` };
}
