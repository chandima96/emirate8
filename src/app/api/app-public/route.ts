import { NextResponse } from 'next/server';
import { loadPublicData } from '@/lib/server/publicData';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await loadPublicData(), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
