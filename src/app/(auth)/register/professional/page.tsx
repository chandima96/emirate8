import { Suspense } from 'react';
import { RegisterWizard } from '@/components/auth/RegisterWizard';

export const metadata = {
  title: { absolute: 'Professional Account — Emirate08' },
  description: 'Upgrade your Emirate08 account to a licensed broker, real estate agency or property developer account.',
  robots: { index: false },
};

export default function ProfessionalRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <RegisterWizard mode="professional" />
    </Suspense>
  );
}
