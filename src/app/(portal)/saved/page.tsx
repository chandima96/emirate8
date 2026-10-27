import { SavedActivity } from '@/components/portal/SavedActivity';
import { QueryToasts } from '@/components/portal/QueryToasts';

export const metadata = {
  title: 'Saved Properties',
  description: 'Your saved properties, recently viewed listings and enquiries, stored with your account.',
};

export default function SavedPage() {
  return (
    <div className="wrap py-8 sm:py-12">
      <QueryToasts />
      <p className="eyebrow">Your activity</p>
      <h1 className="h2 mt-3">Saved &amp; recent</h1>
      <p className="mt-2 max-w-[560px] text-[14px] text-muted">
        Your saved properties and activity are synced with your Emirate08 account.
      </p>
      <SavedActivity />
    </div>
  );
}
