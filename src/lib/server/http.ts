import 'server-only';
import { NextResponse } from 'next/server';
import type { MutationResult } from './result';

export async function readBody(request: Request) {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, value: null };
  }
}

export function cookieOptions(cookie: NonNullable<MutationResult['cookie']>) {
  return {
    ...cookie,
    value: cookie.value || '',
    expires: cookie.expires ? new Date(cookie.expires) : undefined,
    sameSite: cookie.sameSite?.toLowerCase() as 'lax' | 'strict' | 'none' | undefined,
  };
}

export function httpResult(result: MutationResult) {
  const response = NextResponse.json(result.data, { status: result.status });
  if (result.cookie) response.cookies.set(cookieOptions(result.cookie));
  return response;
}
