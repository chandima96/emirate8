'use server';

import { cookies, headers } from 'next/headers';
import { authenticate } from '@/lib/server/auth';
import { updateSession, deleteAccount } from '@/lib/server/session';
import { createEnquiry, updateEnquiryStatus } from '@/lib/server/enquiries';
import { joinWaitlist } from '@/lib/server/waitlist';
import { actionResult, result, type MutationResult } from '@/lib/server/result';
import { cookieOptions } from '@/lib/server/http';

async function run(operation: () => Promise<MutationResult>, fallback: string) {
  try {
    const response = await operation();
    if (response.cookie) (await cookies()).set(cookieOptions(response.cookie));
    return actionResult(response);
  } catch (error) {
    console.error('[action]', fallback, error);
    return actionResult(result({ error: fallback }, { status: 500 }));
  }
}

export async function authenticateAction(body: unknown) {
  return run(async () => authenticate(body, await headers()), 'Could not complete authentication. Please try again.');
}

export async function updateAccountAction(patch: unknown) {
  return run(async () => updateSession(patch, await headers()), 'Could not save your account. Please try again.');
}

export async function deleteAccountAction(password: string) {
  return run(
    async () => deleteAccount({ password }, await headers()),
    'Could not delete your account. Please try again.',
  );
}

export async function createEnquiryAction(body: unknown) {
  return run(async () => createEnquiry(body, await headers()), 'Could not send your enquiry. Please try again.');
}

export async function updateEnquiryStatusAction(id: string, status: string) {
  return run(async () => updateEnquiryStatus({ id, status }, await headers()), 'Could not update the enquiry.');
}

export async function joinWaitlistAction(body: unknown) {
  return run(() => joinWaitlist(body), 'Could not join the waitlist. Please try again.');
}
