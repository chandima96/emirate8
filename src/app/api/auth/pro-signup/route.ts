import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { readBody } from '@/lib/server/http';
import { encodeTicket, proSignupCookie, ticketFromHeaders } from '@/lib/server/proSignup';

function secure(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).startsWith('https://');
}

/** The email the registration wizard must use, if the professional has already confirmed one. */
export async function GET(request: Request) {
  const ticket = ticketFromHeaders(request.headers);
  return NextResponse.json(
    { ticket: ticket ? { email: ticket.email, name: ticket.name || '', provider: ticket.provider } : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Email route: check the address is valid and not already registered, then lock it for the wizard. */
export async function POST(request: Request) {
  const body = await readBody(request);
  const email = body.ok && typeof body.value?.email === 'string' ? body.value.email.trim().toLowerCase() : '';
  const check = await authenticate({ action: 'check-registration-email', email }, request.headers);
  if (check.status >= 400) return NextResponse.json(check.data, { status: check.status });
  const response = NextResponse.json({ ok: true, email });
  response.cookies.set(proSignupCookie(encodeTicket({ email, provider: 'email' }), secure(request)));
  return response;
}

/** "Use a different email": forget the confirmed address. */
export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(proSignupCookie('', secure(request)));
  return response;
}
