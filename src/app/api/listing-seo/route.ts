import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSession } from '@/lib/server/session';
import { creditsAfter, startAiRequest } from '@/lib/server/aiCredits';
import { loadPublicDataSafe } from '@/lib/server/publicData';
import { publicBrokers } from '@/lib/server/landing';
import { runSeoAgentFor } from '@/lib/server/seoAgent/agent';
import { areaFacts, propertyFacts } from '@/lib/seoAgent/facts';
import { publicListing } from '@/lib/publicListing';

export const runtime = 'nodejs';
export const maxDuration = 300;

/*
 * SEO for a listing in the editor: runs the SEO content agent on the draft and returns
 *  - seo: SEO title, meta description and FAQ (saved on the listing as `seo`),
 *  - listingTitle / listingDescription: rewrites the broker reviews in the title and description fields,
 *  - issues: what would make the listing stronger.
 * Called right after autofill and by the editor's "Generate SEO" button. Charged to the member's AI
 * credits (feature `listing_seo`).
 */
export async function POST(request: Request) {
  const session = await getSession(request.headers);
  const user = session.data.user;
  if (!user) return NextResponse.json({ error: 'Sign in to prepare a listing.' }, { status: 401 });
  if (!['broker', 'agency', 'developer', 'owner'].includes(user.type))
    return NextResponse.json({ error: 'Your account cannot create listings.' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'SEO assistance is currently unavailable.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const draft = body?.listing;
  if (!draft || typeof draft !== 'object') return NextResponse.json({ error: 'Send the listing to write SEO for.' }, { status: 400 });

  // The facts as the public page will see them (publicListing applies the location and floor privacy
  // choices), with this member's public profile as the broker.
  const data = await loadPublicDataSafe();
  const me = publicBrokers(data).find((b: any) => String(b.id) === String(user.id));
  const listing = publicListing({ ...draft, broker: draft.broker && typeof draft.broker === 'object' ? draft.broker : me });
  const facts = propertyFacts(listing);
  if (!facts.propertyType || !(facts.area || facts.community || facts.building))
    return NextResponse.json({ error: 'Add the property type and location first, then generate SEO.' }, { status: 422 });

  const gate = await startAiRequest(user.id);
  if (gate.blocked) return gate.blocked;
  const ctx = gate.ctx;
  try {
    const result = await runSeoAgentFor(
      { kind: 'property', path: '', area: String(listing.area || ''), facts, hash: '' },
      listing.area ? areaFacts(data?.listings || [], String(listing.area)) : null,
      { ctx, feature: 'listing_seo', rewrite: true, signal: AbortSignal.any([request.signal, AbortSignal.timeout(240_000)]) },
    );
    const credits = await creditsAfter(ctx);
    if ('error' in result) {
      console.error('[listing-seo] no content:', result.error);
      return NextResponse.json({ error: 'SEO could not be written for this listing. Try again, or add more details first.', credits }, { status: 502 });
    }
    const { title, metaDescription, faq, issues, listingTitle, listingDescription } = (result as Extract<typeof result, { ok: true }>).draft;
    return NextResponse.json(
      { seo: { title, metaDescription, faq, generatedAt: new Date().toISOString() }, listingTitle, listingDescription, issues, credits },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const credits = await creditsAfter(ctx);
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'SEO assistance is busy. Please try again shortly.', credits }, { status: 429 });
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    console.error('[listing-seo] failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: timedOut ? 'Writing SEO took too long. Please try again.' : 'SEO could not be written. Please try again.', credits }, { status: timedOut ? 504 : 502 });
  }
}
