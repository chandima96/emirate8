import { NextResponse } from 'next/server';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { runSeoAgent } from '@/lib/server/seoAgent/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/*
 * Runs the SEO content agent for published pages (platform-paid, results in Payload admin → SEO content).
 * There is no schedule: brokers generate SEO in the listing editor (/api/listing-seo), and staff use the
 * "Generate SEO" button in Payload admin, which calls POST here.
 *
 * POST  (Payload admin session, admin or subadmin)   { "path": "/property/<slug>" }  → that page, forced
 * GET   (Authorization: Bearer $CRON_SECRET)          ?limit=5&path=…                 → scripts / backfills
 */

async function adminUser(request: Request) {
  try {
    const payload = await getPayload({ config: await configPromise });
    const { user } = await payload.auth({ headers: request.headers });
    return user && (user as any).collection === 'users' && ['admin', 'subadmin'].includes((user as any).role) ? user : null;
  } catch {
    return null;
  }
}

const unavailable = () =>
  !process.env.ANTHROPIC_API_KEY ? NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 503 }) : null;

export async function POST(request: Request) {
  if (!(await adminUser(request))) return NextResponse.json({ error: 'Sign in to Payload admin as staff.' }, { status: 401 });
  const blocked = unavailable();
  if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  const path = typeof body?.path === 'string' ? body.path.trim() : '';
  if (!/^\/(property|brokers)\/[^/?#]+$/.test(path)) return NextResponse.json({ error: 'Send the page path, e.g. /property/<slug>.' }, { status: 400 });
  const report = await runSeoAgent({ limit: 1, paths: [path], force: true });
  if (!report.pages) return NextResponse.json({ error: 'That page is not public, so there is nothing to write SEO for yet.', report }, { status: 404 });
  return NextResponse.json(report);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const blocked = unavailable();
  if (blocked) return blocked;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 10, 1), 50);
  const paths = url.searchParams.getAll('path').filter(Boolean);
  return NextResponse.json(await runSeoAgent({ limit, paths: paths.length ? paths : undefined }));
}
