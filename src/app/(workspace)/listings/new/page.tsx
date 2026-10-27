import { Suspense } from 'react';
import { ListingEditor } from '@/components/listings/editor/ListingEditor';

export const metadata = {
  title: 'Add Property',
  description: 'Create or edit a ready or off-plan property, manage photos and preview it before publishing.',
};

export default function NewListingPage() {
  return (
    <Suspense>
      <ListingEditor />
    </Suspense>
  );
}
