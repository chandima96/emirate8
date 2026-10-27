import { NextResponse } from 'next/server';
import { getSession, updateSession, deleteAccount } from '@/lib/server/session';
import { httpResult, readBody } from '@/lib/server/http';

export async function GET(request: Request) {
  return httpResult(await getSession(request.headers));
}

export async function PATCH(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  return httpResult(await updateSession(body.value, request.headers));
}

export async function DELETE(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  return httpResult(await deleteAccount(body.value, request.headers));
}
