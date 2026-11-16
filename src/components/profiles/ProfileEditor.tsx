'use client';

import { useSession } from '@/components/providers/SessionProvider';
import { Portfolio } from '@/components/workspace/Portfolio';
import { BrokerProfileBuilder } from './BrokerProfileBuilder';

/** /profile — agency admins keep the agency portfolio editor; every broker (independent or on an agency team) gets the broker profile builder. */
export function ProfileEditor() {
  const { user } = useSession();
  const agencyOrg = user?.type === 'agency' && user?.agency?.agencyRole !== 'agency_broker';
  return agencyOrg ? <Portfolio /> : <BrokerProfileBuilder />;
}
