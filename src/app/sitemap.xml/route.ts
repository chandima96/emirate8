import { generateSitemaps } from '../sitemaps/sitemap';
import { SITE_URL } from '@/lib/siteUrl';

/*
 * Sitemap index. With generateSitemaps, Next.js serves each part at /sitemaps/sitemap/<id>.xml but not an index,
 * so crawlers (and robots.txt) get one stable entry point here.
 */
export const revalidate = 3600;

export async function GET() {
  const ids = await generateSitemaps();
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ids.map(({ id }) => `  <sitemap><loc>${SITE_URL}/sitemaps/sitemap/${id}.xml</loc></sitemap>`).join('\n') +
    '\n</sitemapindex>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
