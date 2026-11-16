import { ProfileEditor } from '@/components/profiles/ProfileEditor';

export const metadata = {
  title: 'Profile',
  description:
    'Build and manage your public broker portfolio: identity, about, service areas, credentials, contact links, reviews, listings and visibility.',
};

export default function ProfilePage() {
  return <ProfileEditor />;
}
