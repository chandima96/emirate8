import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/*
 * Professional sign-up ticket. Before the registration wizard, a professional either signs in with Google
 * (a verified address) or enters an email that is checked for an existing account. The result is kept in a
 * short-lived, signed, httpOnly cookie; the wizard shows that email read-only and `register` uses it in
 * place of whatever the browser sends.
 */
export const PRO_SIGNUP_COOKIE = 'e08-pro-signup';
export const PRO_SIGNUP_MAX_AGE = 60 * 60; // seconds

export type ProSignupTicket = {
  email: string;
  name?: string;
  provider: 'google' | 'email';
  /** Google account id, for Google sign-ups. */
  sub?: string;
  exp: number;
};

function secret() {
  return process.env.PAYLOAD_SECRET || 'emirate08-pro-signup';
}

function sign(body: string) {
  return createHmac('sha256', `${secret()}:pro-signup`).update(body).digest('base64url');
}

export function encodeTicket(ticket: Omit<ProSignupTicket, 'exp'>): string {
  const body = Buffer.from(
    JSON.stringify({ ...ticket, email: ticket.email.trim().toLowerCase(), exp: Date.now() + PRO_SIGNUP_MAX_AGE * 1000 }),
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeTicket(value: string | undefined | null): ProSignupTicket | null {
  if (!value) return null;
  const [body, mac] = value.split('.');
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!ticket || typeof ticket.email !== 'string' || !['google', 'email'].includes(ticket.provider)) return null;
    if (typeof ticket.exp !== 'number' || ticket.exp < Date.now()) return null;
    if (ticket.provider === 'google' && typeof ticket.sub !== 'string') return null;
    return ticket;
  } catch {
    return null;
  }
}

export function ticketFromHeaders(requestHeaders: Headers): ProSignupTicket | null {
  const header = requestHeaders.get('cookie') || '';
  const match = header.split(/;\s*/).find((part) => part.startsWith(`${PRO_SIGNUP_COOKIE}=`));
  return decodeTicket(match ? decodeURIComponent(match.slice(PRO_SIGNUP_COOKIE.length + 1)) : null);
}

export function proSignupCookie(value: string, secure: boolean) {
  return {
    name: PRO_SIGNUP_COOKIE,
    value,
    httpOnly: true,
    maxAge: value ? PRO_SIGNUP_MAX_AGE : 0,
    path: '/',
    sameSite: 'lax' as const,
    secure,
  };
}

/** The password of an account created with Google; the Google callback signs in with it. */
export function googlePassword(subject: string) {
  return createHmac('sha256', process.env.PAYLOAD_SECRET || 'emirate08-google-oauth')
    .update(`google:${subject}`)
    .digest('hex');
}
