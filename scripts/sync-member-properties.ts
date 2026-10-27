import 'dotenv/config';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { syncMemberProperties } from '../src/lib/server/member-properties';

const config = await configPromise;
const payload = await getPayload({ config });
const result = await payload.find({ collection: 'member-state', limit: 1000, depth: 0, overrideAccess: true });
let synced = 0;

for (const doc of result.docs as any[]) {
  if (typeof doc.key !== 'string' || !doc.key.startsWith('data:')) continue;
  const memberId = Number(doc.member?.id ?? doc.member);
  if (!Number.isFinite(memberId)) continue;
  await syncMemberProperties(payload, memberId, doc.state);
  synced += 1;
}

console.log(`Synced ${synced} member workspace state record(s) into properties.`);
await payload.destroy();
