import { Suspense } from 'react';
import { Network } from '@/components/workspace/network/Network';

export const metadata = {
  title: 'Broker Network',
  description: 'Browse property opportunities from participating brokers.',
};

export default function NetworkPage() {
  return (
    <Suspense>
      <Network />
    </Suspense>
  );
}
