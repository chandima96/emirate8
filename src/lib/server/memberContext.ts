import 'server-only';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

export async function getMemberContext(headers: Headers) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers });
  if (!user || user.collection !== 'members') return null;
  const member: any = await payload.findByID({ collection: 'members', id: user.id, overrideAccess: true });
  if (member.isSuspended === true) return null;
  return { payload, member };
}

export type MemberContext = NonNullable<Awaited<ReturnType<typeof getMemberContext>>>;
