import { Suspense } from 'react';
import { RegisterWizard } from '@/components/auth/RegisterWizard';

export const metadata = {
  title: { absolute: 'Create Account — Emirate08' },
  description:
    'Create your free Emirate08 account to save homes and contact brokers. Brokers, agencies and developers upgrade after confirming their email.',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <RegisterWizard />
    </Suspense>
  );
}
