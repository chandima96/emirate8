'use client';

import { BrokerProfileBuilder } from './BrokerProfileBuilder';

/** /profile — one builder for both: brokers edit their broker profile, agency admins their agency profile. */
export function ProfileEditor() {
  return <BrokerProfileBuilder />;
}
