import { Suspense } from 'react';
import { QuickBuyerForm } from '@/components/auth/QuickBuyerForm';

export const metadata = { title: 'Create Buyer Account', description: 'Create a fast Emirate08 buyer account.' };

export default function BuyerRegisterPage() {
  return <Suspense fallback={<div className="min-h-screen bg-paper" />}><QuickBuyerForm /></Suspense>;
}
