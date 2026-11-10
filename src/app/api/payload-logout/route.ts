import { logout } from '@payloadcms/next/auth';
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

export async function GET(request: Request) {
  // Revoke the active Payload session when possible. Also expire the auth
  // cookie directly so an invalid/stale token cannot bounce back to /admin.
  try {
    await logout({ config });
  } catch {
    // Cookie expiry below still ends the browser session if server-side
    // revocation is unavailable or the token is already invalid.
  }

  const payload = await getPayload({ config });
  const response = NextResponse.redirect(new URL('/admin/login', request.url));
  response.cookies.delete(`${payload.config.cookiePrefix}-token`);

  return response;
}
