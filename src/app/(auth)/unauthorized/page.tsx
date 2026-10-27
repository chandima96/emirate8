import { Suspense } from 'react';
import { Unauthorized } from '@/components/auth/Unauthorized';

export const metadata = {
  title: 'Sign In Required',
  description: 'Sign in to access the Emirate08 broker workspace.',
};

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <Unauthorized />
    </Suspense>
  );
}
