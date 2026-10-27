import { NetworkDetail } from '@/components/workspace/network/NetworkDetail';
import { network } from '@/lib/store';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const n = network(decodeURIComponent(id));
  return {
    title: n ? n.title + ' — Broker Network' : 'Network Property',
    description: 'Network property details from a participating broker.',
  };
}

export default async function NetworkPropertyPage({ params }) {
  const { id } = await params;
  return <NetworkDetail id={decodeURIComponent(id)} />;
}
