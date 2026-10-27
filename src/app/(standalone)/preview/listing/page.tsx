import { Suspense } from 'react';
import { ListingPreviewClient } from '@/components/property/ListingPreviewClient';

export const metadata = {
  title: 'Listing Card Preview',
  description: 'Preview of a listing card before publishing.',
};

/* No site chrome: rendered inside the listing editor's preview iframe. */
export default function ListingPreviewPage() {
  return (
    <main id="main">
      <Suspense fallback={null}>
        <ListingPreviewClient />
      </Suspense>
    </main>
  );
}
