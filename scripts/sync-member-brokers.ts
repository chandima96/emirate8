import 'dotenv/config';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { syncMemberBroker } from '../src/lib/server/member-brokers';

const config = await configPromise;
const payload = await getPayload({ config });
const result = await payload.find({ collection: 'members', where: { accountType: { in: ['broker', 'agency'] } }, limit: 1000, depth: 0, overrideAccess: true });
for (const member of result.docs as any[]) await syncMemberBroker(payload, member);
console.log(`Synced ${result.docs.length} member broker profile(s) into brokers.`);
await payload.destroy();
