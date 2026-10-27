'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion, useHydrated } from '@/hooks/useStore';
import { isSaved, toggleSaved } from '@/lib/store';
import { cx } from '@/lib/utils';

/** Heart toggle for saving a property. Pass `className` to restyle (default: floating `.fav` on cards). */
export function FavButton({ listing, preview = false, className = 'fav', children = undefined }) {
  const { toast } = useFeedback();
  const { user } = useSession();
  useStoreVersion();
  const hydrated = useHydrated();
  if (preview)
    return (
      <button type="button" className={className} tabIndex={-1} aria-hidden="true">
        <Icon name="heart" className="h-[18px] w-[18px]" />
        {children}
      </button>
    );
  const on = hydrated && isSaved(listing.id);
  return (
    <button
      type="button"
      className={cx(className)}
      data-fav={listing.id}
      aria-pressed={on}
      aria-label={(on ? 'Remove ' : 'Save ') + (listing.title || 'property')}
      onClick={(e) => {
        e.preventDefault();
        if (!user) {
          toast(
            <>
              Sign in to save properties.{' '}
              <Link className="underline" href="/login">
                Sign in
              </Link>
            </>,
            { icon: 'heart' },
          );
          return;
        }
        const now = toggleSaved(listing.id);
        toast(
          now ? (
            <>
              Saved.{' '}
              <Link className="underline" href="/saved">
                View saved properties
              </Link>
            </>
          ) : (
            'Removed from saved properties.'
          ),
          { icon: now ? 'heart-fill' : 'heart' },
        );
      }}
    >
      <Icon name="heart" className="h-[18px] w-[18px]" />
      <Icon name="heart-fill" className="h-[18px] w-[18px]" />
      {children}
    </button>
  );
}
