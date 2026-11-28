import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const WEBSITE_FETCH_TIMEOUT_MS = 20_000;

/** Embedded JSON (JSON-LD, Next.js __NEXT_DATA__) pruned to the profile-relevant parts. */
export function structuredData(html: string) {
  const parts: string[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { parts.push('JSON-LD: ' + JSON.stringify(prune(JSON.parse(m[1].trim()))).slice(0, 6000)); } catch { /* skip invalid block */ }
  }
  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next) {
    try {
      const props = JSON.parse(next[1])?.props?.pageProps || {};
      // Agent / broker pages keep the person under one of these keys; fall back to the whole page props.
      const key = ['agent', 'agentDetails', 'broker', 'profile', 'agency', 'company', 'developer'].find((k) => props[k] && typeof props[k] === 'object');
      const picked: Record<string, unknown> = key ? { [key]: props[key] } : props;
      if (props.areasOfExpertise) picked.areasOfExpertise = props.areasOfExpertise;
      parts.push('Page data: ' + JSON.stringify(prune(picked)).slice(0, 24000));
    } catch { /* skip invalid block */ }
  }
  for (const name of ['og:title', 'og:description', 'description']) {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'));
    if (m) parts.push(`${name}: ${m[1]}`);
  }
  return parts.join('\n').trim();
}
const PRUNE_KEYS = /image|logo|photo|avatar|links?$|token|flag|config|abtest|i18n|filter|tracking|snowplow|^ads?|adconfig|^env|seo|breadcrumb|^listings$|^properties$|^property$|^_|countr|remote|campaign|devicePlatform|referer|pageUrl|url$/i;
function prune(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (typeof value === 'string') return value.length > 3000 ? value.slice(0, 3000) : value;
  if (Array.isArray(value)) return value.slice(0, 12).map((x) => prune(x, depth + 1)).filter((x) => x !== undefined);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (PRUNE_KEYS.test(k) && !/linkedin|website|profile/i.test(k)) continue;
      const p = prune(v, depth + 1);
      if (p === undefined || p === null || p === '' || (Array.isArray(p) && !p.length)) continue;
      out[k] = p;
    }
    return out;
  }
  return value;
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return isPrivateAddress(mapped);
    const hex = mapped.split(':').map((part) => parseInt(part || '0', 16));
    if (hex.length === 2) return isPrivateAddress(`${hex[0] >> 8}.${hex[0] & 255}.${hex[1] >> 8}.${hex[1] & 255}`);
  }
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) || normalized.startsWith('ff') || normalized.startsWith('2001:db8:')) return true;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] >= 224;
}

export async function checkedUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Enter a valid public website URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Use a public http or https website URL.');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('That website address is not allowed.');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('That website address is not publicly reachable.');
  return url;
}

export async function readWebsite(raw: string) {
  let url = await checkedUrl(raw);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'Emirate08-ProfileImporter/1.0', Accept: 'text/html,text/plain' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === 3) throw new Error('The website redirected too many times.');
      url = await checkedUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error('Could not read that website. Check that it is publicly accessible.');
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('text/plain')) throw new Error('That link did not return a readable web page.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The website returned no readable content.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3_000_000) { await reader.cancel(); throw new Error('The web page is too large to analyze.'); }
      chunks.push(value);
    }
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    const text = html.replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
    // Portals such as Property Finder keep the agent record (bio, experience, BRN, brokerage, areas…) in
    // embedded JSON that the visible-text pass throws away, so read that first.
    const structured = structuredData(html);
    if (text.length < 80 && !structured) throw new Error('There was not enough readable text on that page.');
    return `Source website: ${url.toString()}\n` + (structured ? `Structured page data (most reliable):\n${structured}\n\n` : '') + `Page text:\n${text.slice(0, 40000)}`;
  }
  throw new Error('Could not read that website.');
}

export function isBayutHost(hostname: string) {
  const hostnameLower = hostname.toLowerCase();
  return hostnameLower === 'bayut.com' || hostnameLower.endsWith('.bayut.com');
}
