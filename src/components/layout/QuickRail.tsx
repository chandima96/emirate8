'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { RAIL_BUYER, RAIL_BROKER } from '@/config/navigation';
import { Icon } from '@/components/ui/Icon';
import { read } from '@/lib/storage';
import { enquiries, inbox } from '@/lib/store';
import { cx } from '@/lib/utils';

const ACTIVE = {
  '/properties': 'search',
  '/saved': 'saved',
  '/dashboard': 'dashboard',
  '/listings': 'listings',
  '/enquiries': 'inbox',
  '/profile': 'profile',
  '/account': 'account',
};

/** Left shortcut rail — only for signed-in users (buyer or broker). Guests get a full-width layout. */
export function QuickRail() {
  const { ready, role } = useSession();
  const pathname = usePathname();
  useStoreVersion();
  if (!ready || role === 'guest') return null;
  const items = role === 'buyer' ? RAIL_BUYER : RAIL_BROKER;
  const counts = {
    saved: read('saved', []).length,
    enquiries: enquiries().length,
    inbox: role === 'broker' ? inbox().filter((q) => q.status !== 'replied').length : 0,
  };
  const active = ACTIVE[pathname];
  return (
    <nav className="quick-rail" aria-label={role === 'buyer' ? 'Your shortcuts' : 'Your workspace'}>
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          className={cx('rail-link', active === it.key && 'is-active')}
          aria-current={active === it.key ? 'page' : undefined}
        >
          <Icon name={it.icon} className="text-[19px]" />
          {it.label}
          <span className="rail-count">{counts[it.key] || ''}</span>
        </Link>
      ))}
    </nav>
  );
}
