import { redirect } from 'next/navigation';

export function LogoutRedirect() {
  redirect('/api/payload-logout');
}
