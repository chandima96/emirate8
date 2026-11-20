import 'server-only';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { result } from './result';
import { confirmationCodeEmail } from './emailTemplates';

/*
 * Email confirmation for new accounts. Every account is created as a buyer and confirms its email
 * with a six-digit code before it can upgrade to a professional account.
 *
 * The code is emailed through Payload (SMTP). Its hash, the member id and an expiry live in a signed,
 * httpOnly cookie, so nothing is stored in the database until the code is confirmed.
 */
export const EMAIL_CODE_COOKIE = 'e08-email-code';
const CODE_TTL = 15 * 60; // seconds
const MAX_ATTEMPTS = 5;

type CodeTicket = { member: string; email: string; hash: string; exp: number; tries: number };

function secret() {
  return process.env.PAYLOAD_SECRET || 'emirate08-email-code';
}
function hashCode(code: string, member: string) {
  return createHmac('sha256', `${secret()}:email-code`).update(`${member}:${code}`).digest('base64url');
}
function sign(body: string) {
  return createHmac('sha256', `${secret()}:email-code-ticket`).update(body).digest('base64url');
}
function encode(ticket: CodeTicket) {
  const body = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return `${body}.${sign(body)}`;
}
function decode(value: string | undefined | null): CodeTicket | null {
  if (!value) return null;
  const [body, mac] = value.split('.');
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return ticket && typeof ticket.hash === 'string' && typeof ticket.exp === 'number' ? ticket : null;
  } catch {
    return null;
  }
}
function readTicket(requestHeaders: Headers) {
  const header = requestHeaders.get('cookie') || '';
  const match = header.split(/;\s*/).find((part) => part.startsWith(`${EMAIL_CODE_COOKIE}=`));
  return decode(match ? decodeURIComponent(match.slice(EMAIL_CODE_COOKIE.length + 1)) : null);
}
function codeCookie(value: string) {
  return {
    name: EMAIL_CODE_COOKIE,
    value,
    httpOnly: true,
    maxAge: value ? CODE_TTL : 0,
    path: '/',
    sameSite: 'Lax' as const,
    secure: (process.env.NEXT_PUBLIC_SITE_URL || '').startsWith('https://'),
  };
}

async function signedInMember(requestHeaders: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  if (!user || user.collection !== 'members') return { payload, member: null };
  const member = (await payload.findByID({ collection: 'members', id: user.id, overrideAccess: true })) as Record<string, any>;
  return { payload, member };
}

export function isEmailVerified(member: Record<string, any> | null | undefined) {
  const profile = member?.profile && typeof member.profile === 'object' ? member.profile : {};
  return profile.emailVerified === true || profile.authProvider === 'google';
}

/** Emails a new six-digit code to the signed-in member. */
export async function sendEmailCode(requestHeaders: Headers) {
  const { payload, member } = await signedInMember(requestHeaders);
  if (!member) return result({ error: 'Sign in to confirm your email.' }, { status: 401 });
  if (isEmailVerified(member)) return result({ ok: true, alreadyVerified: true });

  const code = String(randomInt(100000, 1000000));
  const id = String(member.id);
  const message = confirmationCodeEmail({ name: member.name, code });
  try {
    await payload.sendEmail({ to: member.email, ...message });
  } catch (error) {
    console.error('[email-code] Could not send confirmation email:', error);
    return result({ error: 'We couldn’t send the code right now. Please try again in a moment.' }, { status: 502 });
  }

  const response = result({ ok: true, email: member.email });
  response.cookie = codeCookie(encode({ member: id, email: member.email, hash: hashCode(code, id), exp: Date.now() + CODE_TTL * 1000, tries: 0 }));
  return response;
}

/** Checks the code and marks the member's email as confirmed. */
export async function confirmEmailCode(code: unknown, requestHeaders: Headers) {
  const { payload, member } = await signedInMember(requestHeaders);
  if (!member) return result({ error: 'Sign in to confirm your email.' }, { status: 401 });
  if (isEmailVerified(member)) return result({ ok: true });

  const ticket = readTicket(requestHeaders);
  const id = String(member.id);
  if (!ticket || ticket.member !== id || ticket.email !== member.email || ticket.exp < Date.now()) {
    const response = result({ error: 'This code has expired. Send a new code and try again.', field: 'code' }, { status: 400 });
    response.cookie = codeCookie('');
    return response;
  }
  const entered = typeof code === 'string' ? code.replace(/\D/g, '') : '';
  const expected = Buffer.from(ticket.hash);
  const given = Buffer.from(hashCode(entered, id));
  if (entered.length !== 6 || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    const tries = ticket.tries + 1;
    const locked = tries >= MAX_ATTEMPTS;
    const response = result(
      { error: locked ? 'Too many attempts. Send a new code and try again.' : 'That code doesn’t match. Check your email and try again.', field: 'code' },
      { status: 400 },
    );
    response.cookie = codeCookie(locked ? '' : encode({ ...ticket, tries }));
    return response;
  }

  const profile = member.profile && typeof member.profile === 'object' ? member.profile : {};
  await payload.update({
    collection: 'members',
    id: member.id,
    overrideAccess: true,
    data: { profile: { ...profile, emailVerified: true, emailVerifiedAt: new Date().toISOString() } },
  });
  const response = result({ ok: true });
  response.cookie = codeCookie('');
  return response;
}
