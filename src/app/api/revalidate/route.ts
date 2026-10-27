import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * POST /api/revalidate?tag=cms&secret=<PAYLOAD_SECRET>
 * Call this from Payload hooks (afterChange / afterDelete) to bust the CMS cache.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const tag = searchParams.get('tag') ?? 'cms';

  if (secret !== process.env.PAYLOAD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidateTag(tag, 'max');
  return NextResponse.json({ revalidated: true, tag, now: Date.now() });
}
