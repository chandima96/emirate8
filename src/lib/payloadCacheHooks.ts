import { revalidateTag } from 'next/cache';

export async function invalidateCmsCache() {
  try {
    revalidateTag('cms', 'max');
  } catch (error) {
    // Payload hooks also run from standalone CLI processes such as `npm run seed`.
    // Those processes do not have Next.js's static generation store, so cache
    // invalidation is unavailable there but should not abort the data operation.
    if (
      error instanceof Error &&
      /static generation store|incremental cache/i.test(error.message)
    ) {
      return;
    }

    throw error;
  }
}
