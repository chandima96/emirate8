import { Suspense } from 'react';
import { RegisterWizard } from '@/components/auth/RegisterWizard';

export const metadata = {
  title: { absolute: 'Join Emirate08 — Broker & Agency Registration' },
  description: 'Create your Emirate08 account as a licensed broker or real estate agency in four short steps.',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <RegisterWizard />
    </Suspense>
  );
}
