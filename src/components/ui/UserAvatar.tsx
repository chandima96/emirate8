'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { userPhoto } from '@/lib/store';
import { cx, initialsOf } from '@/lib/utils';

/** The member's profile photo (an agency's logo); initials, or a building for an agency, when there is none. */
export function UserAvatar({ user, className = 'h-9 w-9' }: { user: any; className?: string }) {
  const src = userPhoto(user);
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = Boolean(src) && failed !== src;
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage text-xs font-semibold text-ink',
        className,
      )}
    >
      {showPhoto ? (
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={() => setFailed(src)} />
      ) : user?.type === 'agency' ? (
        <Icon name="building" className="h-4 w-4" />
      ) : (
        initialsOf(user?.name)
      )}
    </span>
  );
}
