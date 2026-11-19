import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/* Server-only: finding the photos on a public listing page and downloading one of them for the editor.
 * Everything here fetches user-supplied URLs, so each request (and each redirect) is checked to point at a
 * public host before it is made. Photos are only offered to the user; nothing is saved until they choose. */

export const MAX_PAGE_IMAGES = 30;
/** Images from elsewhere on a page (similar listings, articles) offered after the listing's own. */
export const MAX_OTHER_IMAGES = 20;
/** How many images one page scan keeps before the sources are merged. */
export const MAX_PAGE_SCAN = 80;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_HTML_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const USER_AGENT = 'Mozilla/5.0 (compatible; ListingPhotoFetcher/1.0)';

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(address: string) {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(ip) === 6) return ip === '::' || ip === '::1' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip);
  return true;
}

/** Throws unless the URL is http(s) on a public host name that resolves only to public addresses. */
export async function assertPublicUrl(raw: string | URL) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Invalid URL.'); }
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal'))
    throw new Error('Not a public URL.');
  const addresses = await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('Not a public URL.');
  return url;
}

/** fetch() that follows at most three redirects, checking every hop is public. */
async function publicFetch(raw: string, init: RequestInit & { signal: AbortSignal }) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(url, { ...init, redirect: 'manual', headers: { 'user-agent': USER_AGENT, ...(init.headers || {}) } });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return response;
    url = await assertPublicUrl(new URL(location, url));
  }
  throw new Error('Too many redirects.');
}

async function readLimited(response: Response, limit: number) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > limit) throw new Error('Too large.');
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error('Too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// Site furniture, not property photos.
const NOT_A_PHOTO = /(?:logo|icon|sprite|avatar|favicon|badge|placeholder|banner-ad|\bads?\b|pixel|tracking|spinner|loader|flag|emoji|agent|broker|profile|qr[-_]?code|watermark|static\/(?:img|images)\/(?:ui|common)|(?:^|[/_-])(?:og-)?default(?:[._-]|$)|share[-_]image|wp-content\/(?:themes|plugins)\/|\/themes?\/[^/]+\/(?:assets|images?|img)\/)/i;
const IMAGE_EXT = /\.(?:jpe?g|png|webp)(?:$|[?#])/i;
const decode = (s: string) => s.replace(/\\u002[fF]/g, '/').replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x2F;/gi, '/');
/* A heading that starts content about other properties: images after it belong to something else. */
const OTHER_SECTION = /\b(?:similar|related|recommended|you (?:may|might) also like|more (?:properties|listings|projects|homes|units|from)|other (?:properties|listings|projects|homes|units)|nearby (?:properties|listings|projects)|recently (?:viewed|added|sold)|explore (?:more|listings|other|similar)|featured (?:properties|listings|projects|developers)|latest (?:properties|listings|projects|news|articles|blogs?)|popular (?:properties|listings|projects|searches|areas)|trending|blogs?|news|insights?|articles?)\b/i;

/** One image found on a page. `other`: it is in a card linking to another page, or after a "Similar …" heading. */
export type PagePhoto = { url: string; other?: boolean };
type Where = 'main' | 'other' | 'unknown';

/** Unwraps image proxies (Next.js /_next/image?url=…, Cloudflare /cdn-cgi/image/…/<url>) to the photo itself. */
export function unwrapImageUrl(href: string) {
  try {
    const url = new URL(href);
    const inner = url.searchParams.get('url');
    if (inner && /\/_(?:next|vercel)\/image\/?$/.test(url.pathname)) return new URL(inner, url).href;
    const cf = url.pathname.match(/\/cdn-cgi\/image\/[^/]+\/(.+)$/);
    if (cf) return new URL(/^https?:/.test(cf[1]) ? cf[1].replace(/^(https?:)\/(?!\/)/, '$1//') : '/' + cf[1], url).href;
  } catch {
    /* not a URL */
  }
  return href;
}

/** Finds the photos on a page, from its HTML or from the Markdown text web_fetch returns. The listing's own
 * photos come first; images of other listings, projects and articles follow, marked `other`. */
export function extractPagePhotos(content: string, pageUrl: string, limit = MAX_PAGE_IMAGES): PagePhoto[] {
  const found = new Map<string, Where[]>();
  const smaller = new Set<string>();
  let page = '';
  try {
    const u = new URL(pageUrl);
    page = u.host + u.pathname.replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  const resolve = (raw: string | undefined) => {
    if (!raw) return '';
    const value = decode(raw.trim());
    if (!value || value.startsWith('data:')) return '';
    try {
      const url = new URL(unwrapImageUrl(new URL(value, pageUrl).href));
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };
  const add = (raw: string | undefined, where: Where) => {
    const href = resolve(raw);
    if (!href || smaller.has(href)) return;
    const path = new URL(href).pathname;
    if (path.length < 2 || NOT_A_PHOTO.test(path) || /\.(?:svg|gif|ico|avif)$/i.test(path)) return;
    if (!IMAGE_EXT.test(path) && /\.[a-z0-9]{2,5}$/i.test(path)) return;
    found.set(href, [...(found.get(href) || []), where]);
  };
  /** True when a link goes to a different page (another listing, project or article), not this page or an image. */
  const elsewhere = (link: string) => {
    if (!link || /^(?:#|javascript:|mailto:|tel:)/i.test(link.trim())) return false;
    try {
      const u = new URL(decode(link), pageUrl);
      if (IMAGE_EXT.test(u.pathname)) return false;
      return u.host + u.pathname.replace(/\/$/, '') !== page;
    } catch {
      return false;
    }
  };
  // Images inside a link to another page are cards for something else.
  const carded = new Set<string>();
  const imagesIn = (markup: string) => [
    ...[...markup.matchAll(/\b(?:data-src|data-lazy-src|data-original|src)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...markup.matchAll(/\b(?:data-)?srcset\s*=\s*["']([^"']+)["']/gi)].flatMap((m) => m[1].split(',').map((part) => part.trim().split(/\s+/)[0])),
  ];
  for (const m of content.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi))
    if (elsewhere(m[1])) for (const src of imagesIn(m[2])) carded.add(resolve(src));
  for (const m of content.matchAll(/\[[^[\]]*!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)[^[\]]*\]\(\s*([^)\s]+)/g))
    if (elsewhere(m[2])) carded.add(resolve(m[1]));
  // Where content about other properties starts: the first such heading after the page's first heading.
  const headings = [...content.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>|^#{1,6}[ \t]+(.+)$/gim)].map((m) => ({ at: m.index ?? 0, text: (m[1] ?? m[2] ?? '').replace(/<[^>]+>/g, ' ') }));
  const cut = headings.find((h, i) => i > 0 && OTHER_SECTION.test(h.text))?.at ?? Infinity;
  const place = (at: number, src: string): Where => (carded.has(resolve(src)) || at > cut ? 'other' : 'main');

  // 1. Social preview images: the page's own choice of headline photo.
  for (const m of content.matchAll(/<meta\b[^>]*>/gi))
    if (/(?:property|name)\s*=\s*["'](?:og:image(?::secure_url)?|twitter:image)["']/i.test(m[0])) add(m[0].match(/content\s*=\s*["']([^"']+)["']/i)?.[1], 'main');
  for (const m of content.matchAll(/^meta-(?:og|twitter):image:\s*(\S+)/gim)) add(m[1], 'main');
  // 2. JSON-LD "image" (a string, an array, or ImageObject.url / contentUrl).
  for (const m of content.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const walk = (node: any, inImage = false) => {
      if (typeof node === 'string') return void (inImage && /^(?:https?:)?\/\//i.test(node.trim()) && add(node, 'unknown'));
      if (Array.isArray(node)) return node.forEach((x) => walk(x, inImage));
      if (!node || typeof node !== 'object') return;
      // Inside an "image" value, an ImageObject's url / contentUrl is the photo.
      for (const [k, v] of Object.entries(node)) walk(v, k === 'image' || k === 'photo' || (inImage && ['url', 'contentUrl'].includes(k)));
    };
    try {
      walk(JSON.parse(m[1]));
    } catch {
      /* malformed JSON-LD is ignored */
    }
  }
  // 3. Images in the markup, preferring the largest srcset entry; lightbox links to the full-size file.
  for (const m of content.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    const at = m.index ?? 0;
    const srcset = tag.match(/\b(?:data-)?srcset\s*=\s*["']([^"']+)["']/i)?.[1];
    if (srcset) {
      const [best, ...rest] = srcset.split(',').map((part) => part.trim().split(/\s+/)).sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0));
      for (const [src] of rest) {
        const href = resolve(src);
        if (href) smaller.add(href);
      }
      if (best?.[0]) add(best[0], place(at, best[0]));
    }
    const src = tag.match(/\b(?:data-src|data-lazy-src|data-original|src)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) add(src, place(at, src));
  }
  for (const m of content.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) add(m[1], place(m.index ?? 0, m[1]));
  // 4. Markdown images (web_fetch text).
  for (const m of content.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g)) add(m[1], place(m.index ?? 0, m[1]));
  // 5. Gallery data embedded in scripts (portals render galleries from JSON); its position says nothing.
  for (const m of content.matchAll(/https?:(?:\\?\/|\\u002[fF]){2}[^"'\s<>()]+?\.(?:jpe?g|png|webp)(?:\?[^"'\s<>()]*)?/gi))
    add(m[0], carded.has(resolve(m[0])) ? 'other' : 'unknown');

  // The listing's own photos: seen in the main content, never only in cards for elsewhere. A photo seen only
  // in data (scripts, JSON-LD) counts when it is stored with the main photos (same host and folder), e.g. a
  // portal's gallery JSON, but not its community or area images on another server.
  const main = [...found].filter(([, where]) => where.includes('main')).map(([url]) => family(url));
  const photos: PagePhoto[] = [...found].map(([url, where]) => {
    const own = where.includes('main') || (!where.includes('other') && (!main.length || main.includes(family(url))));
    return own ? { url } : { url, other: true };
  });
  return largestSizes(photos)
    .sort((a, b) => Number(!!a.other) - Number(!!b.other))
    .slice(0, limit);
}

/** Host and first two folders: where a site keeps one kind of image (".../media/images", ".../uploads/springfield"). */
function family(href: string) {
  try {
    const url = new URL(href);
    return url.host + '/' + url.pathname.split('/').filter(Boolean).slice(0, -1).slice(0, 2).join('/');
  } catch {
    return href;
  }
}

/** Photo URLs only, the listing's own first. */
export function extractImageUrls(content: string, pageUrl: string, limit = MAX_PAGE_IMAGES) {
  return extractPagePhotos(content, pageUrl, limit).map((photo) => photo.url);
}

/* CDNs serve each photo in several sizes: "875769764-400x300.jpeg", ".../<photo>/1312x894.jpg?v=…",
 * "Gallery-1-1024x507.jpg" next to the original "Gallery-1.jpg", or "…?w=3840". Keeps one entry per photo, the
 * largest size seen (an unsized original beats any resized copy), at the position the photo first appeared.
 * A photo seen anywhere as the listing's own stays the listing's own. */
const SIZE_IN_NAME = /[-_](\d{2,4})x(\d{2,4})(?=\.[a-z0-9]+$)/i;
const SIZE_AS_NAME = /\/(\d{2,4})x(\d{2,4})(\.[a-z0-9]+)$/i;
function sizeKey(href: string) {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { key: href, area: 0 };
  }
  let path = url.pathname;
  let area = Infinity;
  const named = path.match(SIZE_AS_NAME) || path.match(SIZE_IN_NAME);
  if (named) {
    area = Number(named[1]) * Number(named[2]);
    path = path.replace(SIZE_AS_NAME, '/$3').replace(SIZE_IN_NAME, '');
  }
  // The same photo is often served as both JPG and WebP.
  path = path.replace(/-scaled(?=\.[a-z0-9]+$)/i, '').replace(/\.(?:jpe?g|png|webp)$/i, '');
  const width = Number(url.searchParams.get('w') || url.searchParams.get('width') || 0);
  if (width && area === Infinity) area = width * width;
  // The query string is only a cache key or resize option when the path is already an image file.
  const query = IMAGE_EXT.test(url.pathname) ? '' : url.search;
  return { key: url.host + path + query, area };
}
export function largestSizes<T extends string | PagePhoto>(items: T[]): T[] {
  const best = new Map<string, { item: T; area: number }>();
  for (const item of items) {
    const url = typeof item === 'string' ? item : item.url;
    const { key, area } = sizeKey(url);
    const seen = best.get(key);
    if (!seen) {
      best.set(key, { item, area });
      continue;
    }
    const keep = area > seen.area ? item : seen.item;
    if (typeof keep === 'string') best.set(key, { item: keep, area: Math.max(area, seen.area) });
    else {
      const other = typeof item !== 'string' && !!item.other && typeof seen.item !== 'string' && !!seen.item.other;
      best.set(key, { item: (other ? { url: keep.url, other } : { url: keep.url }) as T, area: Math.max(area, seen.area) });
    }
  }
  return [...best.values()].map((entry) => entry.item);
}

/** Downloads a public page's HTML (at most 4 MB). Never throws: a page that blocks or fails gives null. */
export async function fetchPublicPage(pageUrl: string, signal: AbortSignal): Promise<{ html: string; url: string } | null> {
  try {
    const response = await publicFetch(pageUrl, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), headers: { accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok || !/html/i.test(response.headers.get('content-type') || '')) return null;
    return { html: new TextDecoder().decode(await readLimited(response, MAX_HTML_BYTES)), url: response.url || pageUrl };
  } catch {
    return null;
  }
}

/** Reads a public page and returns the photos it shows. A page that can't be read gives []. */
export async function findListingImages(pageUrl: string, signal: AbortSignal): Promise<PagePhoto[]> {
  const page = await fetchPublicPage(pageUrl, signal);
  return page ? extractPagePhotos(page.html, page.url, MAX_PAGE_SCAN) : [];
}

/** The visible text of an HTML page, with headings and list items kept as Markdown-style lines. Used when
 * web_fetch returns an empty document for a page our own request can read (e.g. Property Finder). */
export function htmlToText(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return (title + '\n' + body)
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<h([1-6])\b[^>]*>/gi, (_, n) => '\n' + '#'.repeat(Number(n)) + ' ')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer|\/dt|\/dd|\/table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Downloads one public JPG, PNG or WebP image (at most 15 MB). */
export async function fetchPublicImage(url: string, signal: AbortSignal) {
  const response = await publicFetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), headers: { accept: IMAGE_TYPES.join(',') } });
  if (!response.ok) throw new Error('The photo could not be downloaded.');
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const bytes = await readLimited(response, MAX_IMAGE_BYTES);
  const sniffed = sniffImageType(bytes);
  if (!sniffed || (type && !IMAGE_TYPES.includes(type) && type !== 'application/octet-stream')) throw new Error('That link is not a JPG, PNG or WebP photo.');
  return { bytes, type: sniffed };
}

/** The real type from the file's first bytes, so a mislabelled response can't pass as a photo. */
export function sniffImageType(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return '';
}
