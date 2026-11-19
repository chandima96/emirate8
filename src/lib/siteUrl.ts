/** The public origin used for canonical URLs, sitemaps, robots and structured data. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.emirate8.com').replace(/\/$/, '');
export const SITE_NAME = 'Emirate08';

/** Turn a site path (or an already absolute URL) into an absolute URL on the public origin. */
export function absoluteUrl(path = '/') {
  if (!path) return SITE_URL + '/';
  if (/^https?:\/\//.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? '' : '/') + path;
}

/** Plain-text meta description: tags and whitespace collapsed, cut at a word near `max` characters. */
export function metaDescription(text: unknown, max = 158) {
  const plain = String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  return plain.slice(0, max - 3).replace(/\s+\S*$/, '') + '…';
}

/** Serialise JSON-LD for a <script> tag; escaping `<` keeps record text from closing the tag. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
