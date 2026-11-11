import 'dotenv/config';
import config from '../payload.config';
import { getPayload } from 'payload';

const payload = await getPayload({ config });
const [subscribers, payments] = await Promise.all([
  payload.find({ collection: 'members', where: { accountType: { in: ['broker', 'agency', 'developer'] } }, limit: 1, select: { membership: true, membershipStatus: true }, overrideAccess: true }),
  payload.find({ collection: 'membership-payments', limit: 1, depth: 0, overrideAccess: true }),
]);
console.log(JSON.stringify({ subscriberStorage: 'ok', paymentStorage: 'ok', subscribers: subscribers.totalDocs, payments: payments.totalDocs }));
process.exit(0);
