import { Suspense } from 'react';
import { PropertySearch } from '@/components/portal/PropertySearch';
import { CardSkeletons } from '@/components/ui/CardSkeletons';

export const metadata = {
  title: 'Properties for Sale and Rent in the UAE',
  description:
    'Search sample homes and commercial property for sale and rent across Dubai and the UAE, with filters for type, bedrooms, completion and price.',
};

export default function PropertiesPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <CardSkeletons count={8} />
        </div>
      }
    >
      <PropertySearch />
    </Suspense>
  );
}
