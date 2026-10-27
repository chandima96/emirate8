import 'server-only';
import { result, isRecord } from './result';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

export async function joinWaitlist(body: unknown) {
  if (!isRecord(body)) return result({ error: 'Enter a valid email address.' }, { status: 400 });
  if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return result({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const config = await configPromise;
  const payload = await getPayload({ config });
  try {
    await payload.create({
      collection: 'waitlist-signups',
      overrideAccess: true,
      data: {
        email: body.email.trim().toLowerCase(),
        name: typeof body.name === 'string' ? body.name.trim() : '',
        phone: typeof body.phone === 'string' ? body.phone.trim() : '',
        role: 'owner',
        source: body.source === 'register' || body.source === 'sell' ? body.source : 'homepage',
      },
    });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return result({ ok: true, alreadyJoined: true });
    }
    throw error;
  }
  return result({ ok: true }, { status: 201 });
}
