import { NextResponse } from 'next/server';
import { joinWaitlist } from '@/lib/server/waitlist';
import { httpResult, readBody } from '@/lib/server/http';

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  return httpResult(await joinWaitlist(body.value));
}
