import { createHmac } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import { generatePayloadCookie } from 'payload/shared';
import configPromise from '@payload-config';
import { cookieOptions } from '@/lib/server/http';

const STATE_COOKIE = 'e08-google-oauth-state';

function siteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
}

function redirectWithError(origin: string, code: string) {
  return NextResponse.redirect(`${origin}/?authError=${encodeURIComponent(code)}`);
}

function googlePassword(subject: string) {
  return createHmac('sha256', process.env.PAYLOAD_SECRET || 'emirate08-google-oauth')
    .update(`google:${subject}`)
    .digest('hex');
}

export async function GET(request: Request) {
  const origin = siteUrl(request);
  const url = new URL(request.url);
  const store = await cookies();
  const stateCookie = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !stateCookie) {
    return redirectWithError(origin, 'google-not-configured');
  }

  let stateData: { state: string; next: string };
  try {
    stateData = JSON.parse(stateCookie);
  } catch {
    return redirectWithError(origin, 'google-invalid-state');
  }
  if (!stateData.state || stateData.state !== url.searchParams.get('state')) {
    return redirectWithError(origin, 'google-invalid-state');
  }
  if (url.searchParams.get('error')) return redirectWithError(origin, 'google-cancelled');

  const code = url.searchParams.get('code');
  if (!code) return redirectWithError(origin, 'google-missing-code');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/api/auth/google/callback`,
      }),
    });
    if (!tokenResponse.ok) return redirectWithError(origin, 'google-token-failed');
    const token = await tokenResponse.json();

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) return redirectWithError(origin, 'google-profile-failed');
    const profile = await profileResponse.json();
    if (!profile.sub || !profile.email || profile.email_verified === false) {
      return redirectWithError(origin, 'google-email-unverified');
    }

    const config = await configPromise;
    const payload = await getPayload({ config });
    const members = config.collections.find((collection) => collection.slug === 'members');
    if (!members?.auth) return redirectWithError(origin, 'google-auth-unavailable');

    const email = String(profile.email).trim().toLowerCase();
    const existing = await payload.find({
      collection: 'members',
      limit: 1,
      overrideAccess: true,
      where: { email: { equals: email } },
    });
    const member = existing.docs[0] as Record<string, any> | undefined;
    const password = googlePassword(String(profile.sub));

    if (member) {
      const existingProfile = member.profile && typeof member.profile === 'object' ? member.profile : {};
      if (existingProfile.googleSubject !== profile.sub) {
        return redirectWithError(origin, 'google-email-exists');
      }
    } else {
      await payload.create({
        collection: 'members',
        overrideAccess: true,
        data: {
          email,
          password,
          name: String(profile.name || profile.email.split('@')[0]).trim(),
          mobile: '',
          accountType: 'buyer',
          profile: {
            legalName: String(profile.name || profile.email.split('@')[0]).trim(),
            authProvider: 'google',
            googleSubject: String(profile.sub),
            trial: false,
            notifications: { enquiries: true, network: true, selection: true, billing: true, product: false },
            privacy: { showPhone: true, showEmail: true, showWhatsapp: true, showBrn: true, showLanguages: true, showExperience: true, showTransactions: true },
            prefs: { language: 'English', currency: 'AED', contact: 'email' },
          },
          credentialStatus: 'pending',
          plan: 'starter',
          adminCreated: false,
          adminAccess: false,
        } as any,
      });
    }

    const loggedIn = await payload.login({
      collection: 'members',
      data: { email, password },
      overrideAccess: true,
    });
    if (!loggedIn.token) return redirectWithError(origin, 'google-login-failed');

    const response = NextResponse.redirect(`${origin}${stateData.next || '/saved'}`);
    response.cookies.set(
      cookieOptions(
        generatePayloadCookie({
          returnCookieAsObject: true,
          collectionAuthConfig: members.auth,
          cookiePrefix: config.cookiePrefix || 'payload',
          token: loggedIn.token,
        }),
      ),
    );
    return response;
  } catch (error) {
    console.error('[google-auth]', error);
    return redirectWithError(origin, 'google-login-failed');
  }
}
