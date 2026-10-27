'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wordmark } from '@/components/layout/Wordmark';
import { Icon } from '@/components/ui/Icon';
import { CardSkeletons } from '@/components/ui/CardSkeletons';
import { Dropdown } from '@/components/ui/Dropdown';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { WORKSPACE_NAV, WORKSPACE_NETWORK } from '@/config/navigation';
import { counts, fmtNumber, plan, signOut } from '@/lib/store';
import { cx, initialsOf } from '@/lib/utils';
import { notificationPropertyHref } from '@/lib/notificationLinks';

const SECTIONS = [
  ['/dashboard', 'overview', 'Overview'],
  ['/listings', 'listings', 'My Listings'],
  ['/enquiries', 'enquiries', 'Enquiries'],
  ['/profile', 'profile', 'Profile'],
  ['/account', 'account', 'Account'],
  ['/network', 'network', 'Broker Network'],
  ['/selected', 'selected', 'Selected Properties'],
  ['/subscription', 'subscription', 'Subscription'],
  ['/agency-dashboard', 'agency', 'Agency Dashboard'],
  ['/agency-team', 'team', 'Team'],
  ['/developer-dashboard', 'developer', 'Developer Dashboard'],
  ['/developer-network', 'developerNetwork', 'Developers Network'],
];

function sectionFor(pathname) {
  return SECTIONS.find(([p]) => pathname === p || pathname.startsWith(p + '/')) || SECTIONS[0];
}

function SideLink({ item, active, count, onNavigate }) {
  const on = item.key === active;
  return (
    <Link
      href={item.href}
      className={cx('side-link', on && 'is-active')}
      aria-current={on ? 'page' : undefined}
      onClick={onNavigate}
    >
      <Icon name={item.icon} />
      {item.label}
      <span className="count">{count || ''}</span>
    </Link>
  );
}

/** Workspace chrome (sidebar, top bar, mobile drawer) and the access guard for broker-only pages. */
export function AppShell({ children }) {
  const { ready, user, role } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const storeVersion = useStoreVersion();
  const [, active, sectionHeading] = sectionFor(pathname);
  const heading = role === 'agency' && pathname === '/profile' ? 'Agency Portfolio' : sectionHeading;

  useEffect(() => {
    if (!ready) return;
    const isAgencyBroker = role === 'agency' && user?.agency?.agencyRole === 'agency_broker';
    const brokerCredentials = user?.credentials || {};
    const hasBrokerCredentials = /^\d{3,8}$/.test(String(brokerCredentials.brn || '')) &&
      Boolean(brokerCredentials.expiry) && Boolean(brokerCredentials.cardFile);
    if (!user) router.replace('/unauthorized?next=' + encodeURIComponent(pathname + window.location.search));
    else if (user.mustChangePassword && pathname !== '/change-password') router.replace('/change-password?next=' + encodeURIComponent('/agency-dashboard'));
    else if (isAgencyBroker && !hasBrokerCredentials && pathname !== '/agency-verification') router.replace('/agency-verification');
    else if (isAgencyBroker && user.credentialStatus !== 'verified' && (pathname === '/listings' || pathname.startsWith('/listings/'))) router.replace('/agency-verification');
    else if (role === 'buyer') router.replace('/saved?workspace=brokers');
    else if (role !== 'agency' && pathname === '/agency-team') router.replace('/agency-dashboard');
    else if (role === 'agency' && pathname === '/dashboard') router.replace('/agency-dashboard');
    else if (role === 'developer' && pathname === '/dashboard') router.replace('/developer-dashboard');
    else if (!['broker', 'agency'].includes(role) && pathname === '/developer-network') router.replace('/developer-dashboard');
    else if (role !== 'broker' && (pathname === '/network' || pathname.startsWith('/network/') || pathname === '/selected' || pathname.startsWith('/selected/'))) {
      router.replace(role === 'developer' ? '/developer-dashboard' : '/agency-dashboard');
    }
  }, [ready, user, role, pathname, router]);

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return undefined;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && close();
    const onResize = () => window.innerWidth >= 1024 && close();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const allowed = ready && user && ['broker', 'agency', 'developer'].includes(role);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);
  const unreadNotifications = notifications.filter((item) => !item.read).length;
  useEffect(() => {
    if (!allowed) return undefined;
    let alive = true;
    const loadNotifications = () => {
      fetch('/api/role-workspace?notifications=1', { credentials: 'same-origin', cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (alive) setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
        })
        .catch(() => undefined);
    };
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [allowed]);
  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    const closeOnEscape = (event) => event.key === 'Escape' && setNotificationsOpen(false);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);
  const markNotificationRead = async (id) => {
    setNotifications((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)));
    await fetch('/api/role-workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'mark-notification-read', id }),
    }).catch(() => undefined);
  };
  const openNotification = async (item) => {
    if (!item.read) await markNotificationRead(item.id);
    setNotificationsOpen(false);
    const href = notificationPropertyHref(item);
    if (href) router.push(href);
  };
  const c = allowed ? counts(user) : { listings: 0, selected: 0, network: 0, enquiries: 0 };
  const p = allowed ? plan(user) : null;
  const cnt = { listings: c.listings, selected: c.selected, network: c.network, enquiries: c.enquiries };
  const nav =
    role === 'developer'
      ? [
          { label: 'Developer Dashboard', href: '/developer-dashboard', key: 'developer', icon: 'grid-1x2' },
          { label: 'Properties', href: '/listings', key: 'listings', icon: 'buildings' },
          { label: 'Account', href: '/account', key: 'account', icon: 'gear' },
        ]
      : role === 'agency'
        ? [
            { label: 'Agency Dashboard', href: '/agency-dashboard', key: 'agency', icon: 'grid-1x2' },
            { label: 'Portfolio', href: '/profile', key: 'profile', icon: 'building' },
            { label: 'Team', href: '/agency-team', key: 'team', icon: 'people' },
            { label: 'Developers Network', href: '/developer-network', key: 'developerNetwork', icon: 'building' },
            { label: 'Properties', href: '/listings', key: 'listings', icon: 'buildings' },
            { label: 'Enquiries', href: '/enquiries', key: 'enquiries', icon: 'inbox' },
            { label: 'Account', href: '/account', key: 'account', icon: 'gear' },
          ]
        : WORKSPACE_NAV;

  const logout = () => {
    signOut();
    // Hard navigation avoids a race with the workspace guard while returning to the public homepage.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen lg:pl-[224px]">
      <aside
        className={cx(
          'on-dark fixed inset-y-0 left-0 z-[70] flex w-[260px] flex-col bg-ink-deep transition-transform duration-300 lg:w-[224px] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Workspace navigation"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Wordmark href="/dashboard" dark label="Emirate08 workspace" />
          <button type="button" className="text-white/70 lg:hidden" onClick={close} aria-label="Close navigation">
            <Icon name="x-lg" className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-2 flex flex-col gap-0.5 px-3">
          {nav.map((it) => (
            <SideLink key={it.key} item={it} active={active} count={cnt[it.key]} onNavigate={close} />
          ))}
          {role === 'broker' && (
            <>
              <p className="mt-5 px-3 pb-1 text-[10px] font-semibold tracking-[.14em] text-[#6F7E7B] uppercase">Network</p>
              {WORKSPACE_NETWORK.map((it) => (
                <SideLink key={it.key} item={it} active={active} count={cnt[it.key]} onNavigate={close} />
              ))}
            </>
          )}
          {user?.adminAccess && user?.adminCreated && (
            <>
              <p className="mt-5 px-3 pb-1 text-[10px] font-semibold tracking-[.14em] text-[#6F7E7B] uppercase">Administration</p>
              <Link href="/control-room" className="side-link" onClick={close}>
                <Icon name="speedometer2" />
                Control Room
              </Link>
            </>
          )}
        </nav>
        <div className="mt-auto p-3">
          <div className="rounded-lg border border-white/10 p-3">
            <div className="flex items-center justify-between text-2xs">
              <span className="text-[#8C9996]">Plan</span>
              <span className="font-semibold text-white">{p ? p.name + (user.trial ? ' Trial' : '') : '—'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-2xs">
              <span className="text-[#8C9996]">Selections</span>
              <span className="text-white">{p ? `${c.selected} / ${fmtNumber(p.selections)}` : '—'}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full bg-sage"
                style={{ width: p ? Math.min(100, (c.selected / p.selections) * 100) + '%' : 0 }}
              />
            </div>
            <Link
              href="/subscription"
              className="mt-3 inline-flex items-center gap-1 text-2xs font-semibold text-sage"
              onClick={close}
            >
              Manage plan
              <Icon name="arrow-right" className="h-3 w-3" />
            </Link>
          </div>
          <Link
            href="/brokers/me"
            className="mt-2 flex h-9 items-center gap-2 px-3 text-xs text-[#8C9996] hover:text-white"
          >
            <Icon name="box-arrow-up-right" className="h-4 w-4" />
            View my public portfolio
          </Link>
          <Link href="/" className="flex h-9 items-center gap-2 px-3 text-xs text-[#8C9996] hover:text-white">
            <Icon name="globe2" className="h-4 w-4" />
            Public website
          </Link>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-[65] bg-ink-deep/50 lg:hidden" onClick={close} />}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          className="btn btn-outline h-9 w-9 px-0 lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
        >
          <Icon name="list" />
        </button>
        <p className="truncate font-display text-[15px] font-semibold text-ink">{heading}</p>
        <span
          className="badge badge-warn ml-1 hidden sm:inline-flex"
          title="Membership features are still being finalized"
        >
          <Icon name="info-circle" className="h-3 w-3" />
          Demo workspace
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-mist"
              aria-label={unreadNotifications ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
              aria-expanded={notificationsOpen}
              aria-haspopup="true"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Icon name={unreadNotifications ? 'bell-fill' : 'bell'} className="h-[18px] w-[18px]" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute top-full right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-pop">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Notifications</p>
                    <p className="mt-0.5 text-2xs text-muted">Recent workspace activity</p>
                  </div>
                  {unreadNotifications > 0 && <span className="badge badge-warn">{unreadNotifications} unread</span>}
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.slice(0, 8).map((item) => (
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 border-b border-mist px-4 py-3 text-left last:border-0 hover:bg-mist"
                      key={item.id}
                      onClick={() => void openNotification(item)}
                    >
                      <Icon name={item.read ? 'bell' : 'bell-fill'} className={item.read ? 'mt-0.5 h-4 w-4 text-muted' : 'mt-0.5 h-4 w-4 text-sage-ink'} />
                      <span className="min-w-0 flex-1">
                        <span className={item.read ? 'block text-xs font-medium text-text' : 'block text-xs font-semibold text-ink'}>{item.title}</span>
                        <span className="mt-1 block text-2xs leading-relaxed text-muted">{item.message || 'Workspace activity updated.'}</span>
                      </span>
                      {!item.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />}
                    </button>
                  ))}
                  {!notifications.length && <p className="px-4 py-6 text-center text-xs text-muted">No notifications yet.</p>}
                </div>
              </div>
            )}
          </div>
          <Link href="/listings/new" className="btn btn-dark btn-sm hidden sm:inline-flex">
            <Icon name="plus-lg" />
            Add Property
          </Link>
          {allowed && (
            <Dropdown
              align="right"
              menuClassName="w-52"
              button={(props) => (
                <button type="button" className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-mist" {...props}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sage text-xs font-semibold text-ink">
                    {initialsOf(user.name)}
                  </span>
                  <span className="hidden text-left md:block">
                    <span className="block text-xs leading-tight font-semibold text-ink">{user.name}</span>
                    <span className="block text-2xs leading-tight text-muted">
                      {user.type === 'agency' ? 'Agency account' : user.type === 'developer' ? 'Developer account' : 'Licensed broker'}
                    </span>
                  </span>
                  <Icon name="chevron-down" className="h-4 w-4 text-muted" />
                </button>
              )}
            >
              {(role === 'developer'
                ? [['/developer-dashboard', 'grid-1x2', 'Developer dashboard'], ['/account', 'gear', 'Account settings']]
                : role === 'agency'
                  ? [['/agency-dashboard', 'grid-1x2', 'Agency dashboard'], ['/account', 'gear', 'Account settings']]
                  : [
                      ['/profile', 'person-badge', 'Profile (public portfolio)'],
                      ['/brokers/me', 'box-arrow-up-right', 'View my public portfolio'],
                      ['/account', 'gear', 'Account settings'],
                      ['/subscription', 'credit-card', 'Subscription'],
                    ]
              ).map(([href, icon, label]) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  className="flex h-9 items-center gap-2 rounded px-2.5 text-[13px] hover:bg-mist"
                >
                  <Icon name={icon} className="h-4 w-4" />
                  {label}
                </Link>
              ))}
              <div className="my-1 h-px bg-line" />
              <button
                type="button"
                role="menuitem"
                className="flex h-9 w-full items-center gap-2 rounded px-2.5 text-[13px] text-danger hover:bg-danger-soft"
                onClick={logout}
              >
                <Icon name="box-arrow-right" className="h-4 w-4" />
                Sign out
              </button>
            </Dropdown>
          )}
        </div>
      </header>
      <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {allowed ? (
          children
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <CardSkeletons count={6} variant="summary" />
          </div>
        )}
      </main>
    </div>
  );
}
