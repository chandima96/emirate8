import { redirect } from 'next/navigation';

/** Buyer sign-up now lives in the register wizard (account type → your details). */
export default async function BuyerRegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const params = new URLSearchParams({ type: 'buyer', step: 'details' });
  if (next) params.set('next', next);
  redirect(`/register?${params.toString()}`);
}
