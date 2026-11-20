import { Suspense } from 'react';
import { RegisterWizard } from '@/components/auth/RegisterWizard';

export const metadata = {
  title: { absolute: 'Create Account — Emirate08' },
  description: 'Create your Emirate08 account as a real estate agency, licensed broker, property developer or buyer.',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <RegisterWizard />
    </Suspense>
  );
}
