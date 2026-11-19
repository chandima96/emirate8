import { NextResponse } from 'next/server';
import { runSeoAgent } from '@/lib/server/seoAgent/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/*
 * Runs one pass of the SEO content agent. Called by a scheduler (Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`), or by hand with the same header:
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://<site>/api/seo-agent/run?limit=5"
 *   …&path=/property/<slug>   regenerate specific pages (repeatable)
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 503 });

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 10, 1), 50);
  const paths = url.searchParams.getAll('path').filter(Boolean);
  const report = await runSeoAgent({ limit, paths: paths.length ? paths : undefined });
  return NextResponse.json(report);
}
