import { PropertyFeed } from '@/components/workspace/network/PropertyFeed';

export const metadata = {
  title: 'Property Feed API',
  description: 'Choose which published properties your website pulls through the Emirate08 property feed API.',
};

export default function SelectedPage() {
  return <PropertyFeed />;
}
