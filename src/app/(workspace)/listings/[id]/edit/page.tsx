import { Suspense } from 'react';
import { ListingEditor } from '@/components/listings/editor/ListingEditor';

export const metadata = {
  title: 'Edit Property',
  description: 'Edit a ready or off-plan property, manage photos and preview it before publishing.',
};

export default async function EditListingPage({ params }) {
  const { id } = await params;
  return (
    <Suspense>
      <ListingEditor key={id} id={decodeURIComponent(id)} />
    </Suspense>
  );
}
