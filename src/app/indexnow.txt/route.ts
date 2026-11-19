import { indexNowKey } from '@/lib/server/indexNow';

/** IndexNow key file: search engines fetch it to confirm the pings come from this site's owner. */
export function GET() {
  const key = indexNowKey();
  if (!key) return new Response('Not found', { status: 404 });
  return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
