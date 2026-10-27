import { Suspense } from 'react';
import { ListingsList } from '@/components/listings/ListingsList';

export const metadata = {
  title: 'My Listings',
  description: 'Manage your sale and rental listings.',
};

export default function ListingsPage() {
  return (
    <Suspense>
      <ListingsList />
    </Suspense>
  );
}
