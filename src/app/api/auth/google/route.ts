import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const STATE_COOKIE = 'e08-google-oauth-state';

function siteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
}

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/saved';
}

export async function GET(request: Request) {
  const origin = siteUrl(request);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const params0 = new URL(request.url).searchParams;
  const next = safeNext(params0.get('next'));
  // Professionals sign up through the registration wizard: Google only confirms their email.
  const intent = params0.get('intent') === 'professional' ? 'professional' : 'buyer';

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      intent === 'professional'
        ? `${origin}/login?register=professional&authError=google-not-configured`
        : `${origin}/?authError=google-not-configured`,
    );
  }

  const state = randomBytes(24).toString('hex');
  const store = await cookies();
  store.set(STATE_COOKIE, JSON.stringify({ state, next, intent }), {
    httpOnly: true,
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
    secure: origin.startsWith('https://'),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
