'use client';

import { useSession } from '@/components/providers/SessionProvider';
import { BrokerProfileBuilder } from './BrokerProfileBuilder';
import { DeveloperProfileEditor } from './DeveloperProfileEditor';

/** /profile — brokers edit their broker profile, agency admins their agency profile, developers their company profile. */
export function ProfileEditor() {
  const { role } = useSession();
  if (role === 'developer') return <DeveloperProfileEditor />;
  return <BrokerProfileBuilder />;
}
