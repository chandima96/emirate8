import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getCreditStatus, publicCredits } from '@/lib/server/aiCredits';

export const runtime = 'nodejs';

/** The signed-in member's AI-credit balance for this month (shared with the agency pool for agency seats). */
export async function GET(request: Request) {
  const session = await getSession(request.headers);
  const user = session.data.user;
  if (!user) return NextResponse.json({ error: 'Sign in to see your AI credits.' }, { status: 401 });
  try {
    const status = await getCreditStatus(user.id);
    return NextResponse.json({ credits: publicCredits(status), byFeature: status.byFeature }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[ai-credits] balance lookup failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'AI credits are unavailable right now.' }, { status: 503 });
  }
}
