import { NextResponse, type NextRequest } from 'next/server';
import { readBody } from '@/lib/server/http';
import { resolveEmbed } from '@/lib/server/propertyFeed';
import { createPartnerEnquiry, readPartnerEnquiry } from '@/lib/server/enquiries';

/*
 * Submit target of the embedded enquiry form (src/app/(standalone)/embed/enquiry). The form runs on our
 * origin inside the partner's iframe, so this is a same-origin request and needs no CORS or API key:
 * the signed feed/property pair from the embed link authorises it.
 */

export const dynamic = 'force-dynamic';

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

/** In-memory, per server instance: a spam brake, not an accounting limit. */
function allow(key: string, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((at) => now - at < WINDOW_MS);
  const allowed = recent.length < MAX_PER_WINDOW;
  if (allowed) recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((at) => now - at < WINDOW_MS)) hits.delete(k);
  return allowed;
}

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const data = body.ok && body.value && typeof body.value === 'object' ? (body.value as Record<string, unknown>) : null;
  if (!data) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });

  // Honeypot: a hidden field people never fill in. Pretend success so bots learn nothing.
  if (typeof data.website === 'string' && data.website.trim()) return NextResponse.json({ ok: true }, { status: 201 });

  const feedId = String(data.f ?? '');
  const propertyId = String(data.propertyId ?? '');
  const embed = await resolveEmbed(feedId, propertyId, String(data.t ?? ''));
  if (!embed) {
    return NextResponse.json({ error: 'This property is no longer available for enquiries here.' }, { status: 404 });
  }

  const form = readPartnerEnquiry(data);
  if (!form.value) return NextResponse.json({ error: 'Please check the form.', fields: form.errors }, { status: 400 });

  if (!allow(`${clientIp(request)}:${feedId}`)) {
    return NextResponse.json({ error: 'Too many enquiries. Please try again in a few minutes.' }, { status: 429 });
  }

  const partnerPage = typeof data.partnerPage === 'string' && /^https?:\/\//i.test(data.partnerPage) ? data.partnerPage : `partner feed #${feedId}`;
  await createPartnerEnquiry(embed.payload, { feed: embed.feed, listing: embed.listing, partnerPage }, form.value);
  return NextResponse.json({ ok: true }, { status: 201 });
}
