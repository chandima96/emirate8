import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { getSession } from '@/lib/server/session';
import { buildCatalogue, searchCatalogue } from '@/lib/listingCatalogue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Building catalogue built from published, publicly located listings; refreshed with the CMS cache. */
const loadCatalogue = unstable_cache(
  async () => {
    const payload = await getPayload({ config: await configPromise });
    const { docs } = await payload.find({
      collection: 'properties',
      where: {
        and: [{ status: { in: ['published', 'sold', 'rented'] } }, { 'display.visible': { not_equals: false } }],
      },
      sort: '-updatedAt',
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    });
    return buildCatalogue(docs);
  },
  ['listing-catalogue'],
  { tags: ['cms'], revalidate: 600 },
);

export async function GET(request: Request) {
  const session = await getSession(request.headers);
  const user = session.data.user;
  if (!user) return NextResponse.json({ error: 'Sign in to search buildings.' }, { status: 401 });
  if (!['broker', 'agency', 'developer', 'owner'].includes(user.type))
    return NextResponse.json({ error: 'Your account cannot create listings.' }, { status: 403 });
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').slice(0, 80);
  const emirate = (url.searchParams.get('emirate') || '').slice(0, 40);
  try {
    const buildings = searchCatalogue(await loadCatalogue(), q, emirate);
    return NextResponse.json({ buildings }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    console.error('[listing-catalogue] lookup failed:', error);
    return NextResponse.json({ buildings: [] });
  }
}
