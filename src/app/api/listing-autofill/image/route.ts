import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { fetchPublicImage } from '@/lib/listingImagesServer';

export const runtime = 'nodejs';

/* Downloads one photo that listing autofill found on a public page, so the editor can preview it and,
 * once the user confirms they may use it, upload it through the normal photo pipeline. Browsers can't
 * fetch most portal images themselves (CORS, hotlink protection). No AI credits are used. */
export async function GET(request: Request) {
  const session = await getSession(request.headers);
  const user = session.data.user;
  if (!user) return NextResponse.json({ error: 'Sign in to add photos.' }, { status: 401 });
  if (!['broker', 'agency', 'developer', 'owner'].includes(user.type)) return NextResponse.json({ error: 'Your account cannot create listings.' }, { status: 403 });
  const url = new URL(request.url).searchParams.get('url') || '';
  try {
    const { bytes, type } = await fetchPublicImage(url, request.signal);
    return new NextResponse(bytes, { headers: { 'content-type': type, 'cache-control': 'private, max-age=600', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    const message = error instanceof Error && /JPG, PNG or WebP/.test(error.message) ? error.message : 'The photo could not be downloaded.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
