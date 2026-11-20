import { redirect } from 'next/navigation';

/** Everyone signs up on /register; this old buyer URL forwards there. */
export default async function BuyerRegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(next ? `/register?${new URLSearchParams({ next })}` : '/register');
}
