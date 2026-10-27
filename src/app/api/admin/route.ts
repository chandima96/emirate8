import { NextResponse } from 'next/server';
import { adminRequest } from '@/lib/server/admin';
import { httpResult, readBody } from '@/lib/server/http';

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  return httpResult(await adminRequest(body.value, request.headers));
}
