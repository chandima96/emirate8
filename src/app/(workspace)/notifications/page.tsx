import { redirect } from 'next/navigation';

export const metadata = { title: 'Notifications', description: 'Workspace notifications.' };

export default function NotificationsPage() {
  redirect('/dashboard');
}
