import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { searchCatalogue } from '@/lib/listingCatalogue';
import { loadCatalogue } from '@/lib/server/listingCatalogueData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
