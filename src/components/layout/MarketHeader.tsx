'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Wordmark } from './Wordmark';
import { MEGA, LEFT_MENUS, RAIL_BUYER, RAIL_BROKER } from '@/config/navigation';
import { useSession } from '@/components/providers/SessionProvider';
import { signOut } from '@/lib/store';
import { initialsOf, cx } from '@/lib/utils';
import { AuthChoiceModal } from '@/components/auth/AuthChoiceModal';
import { BuyerSignupModal } from '@/components/auth/BuyerSignupModal';

function MegaPanel({ id, onKeyDown }) {
  const m = MEGA[id];
  return (
    <div
      className="mega-panel is-open"
      id={'mega-' + id}
      role="region"
      aria-label={m.label + ' menu'}
      onKeyDown={onKeyDown}
    >
      <div className="wrap flex flex-wrap py-9">
        {m.groups.map((g, gi) => (
          <div key={g.title} className={cx(gi && 'lg:border-l lg:border-line lg:pl-12', 'pr-12')}>
            <p className="mb-5 font-display text-[18px] font-semibold tracking-[-0.015em] text-ink">{g.title}</p>
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              {g.cols.map(([heading, links]) => (
                <div key={heading} className="min-w-[180px]">
                  <p className="mb-2 text-[13px] font-semibold text-ink">{heading}</p>
                  <ul className="space-y-0.5">
                    {links.map(([label, href]) => (
                      <li key={label}>
                        <Link className="mega-link" href={href}>
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountMenu({ user, role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const items =
    role === 'buyer'
      ? RAIL_BUYER
      : [
          ...RAIL_BROKER,
          { icon: 'box-arrow-up-right', label: 'View my portfolio', href: '/brokers/me', key: 'portfolio' },
        ];
  return (
    <div className="relative ml-2" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-mist"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage text-xs font-semibold text-ink">
          {user.type === 'agency' ? <Icon name="building" className="h-4 w-4" /> : initialsOf(user.name)}
        </span>
        <Icon name="chevron-down" className="hidden h-3.5 w-3.5 text-muted sm:inline-flex" />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 z-50 mt-1 w-60 rounded-lg border border-line bg-white p-1 shadow-pop"
          role="menu"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-2xs text-muted">
              {role === 'buyer'
                ? 'Buyer & tenant account'
                : user.type === 'agency'
                  ? 'Agency account'
                  : 'Broker account'}
            </p>
          </div>
          {items.map((it) => (
            <Link
              key={it.key}
              href={it.href}
              role="menuitem"
              className="flex h-9 items-center gap-2 rounded px-2.5 text-[13px] hover:bg-mist"
              onClick={() => setOpen(false)}
            >
              <Icon name={it.icon} className="h-4 w-4" />
              {it.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            className="flex h-9 w-full items-center gap-2 rounded px-2.5 text-[13px] text-danger hover:bg-danger-soft"
            onClick={() => {
              signOut();
              router.push('/');
            }}
          >
            <Icon name="box-arrow-right" className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MobileMenu({ open, onClose, user, role, onSignIn }) {
  const [expanded, setExpanded] = useState(null);
  const panelRef = useRef(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return undefined;
    document.documentElement.style.overflow = 'hidden';
    panelRef.current?.animate?.(
      [
        { transform: 'translateX(-24px)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 260, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
    panelRef.current?.querySelector('a, button')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onResize = () => window.innerWidth >= 1280 && onClose();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div id="mobile-menu" className="fixed inset-0 z-[60] xl:hidden">
      <div className="absolute inset-0 bg-ink-deep/50" onClick={onClose} />
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0 flex w-full max-w-[400px] flex-col bg-white"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <Wordmark size="text-[18px]" />
          <button type="button" className="btn btn-outline h-11 w-11 px-0" onClick={onClose} aria-label="Close menu">
            <Icon name="x-lg" />
          </button>
        </div>
        <nav
          className="flex-1 overflow-y-auto"
          aria-label="Mobile"
          onClick={(e) => (e.target as Element).closest('a') && onClose()}
        >
          {[...LEFT_MENUS, 'pros'].map((key) => {
            const m = MEGA[key];
            const isOpen = expanded === key;
            return (
              <div key={key} className="border-b border-line">
                <button
                  type="button"
                  className="acc-btn flex min-h-[56px] w-full items-center justify-between px-5 text-left text-[16px] font-semibold text-ink"
                  aria-expanded={isOpen}
                  aria-controls={'macc-' + key}
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  {m.label}
                  <Icon name="chevron-down" className="acc-chev h-4 w-4 text-muted" />
                </button>
                <div id={'macc-' + key} className="acc-body acc-in" hidden={!isOpen}>
                  <div className="pb-3">
                    {m.groups.flatMap((g) =>
                      g.cols.map(([heading, links]) => (
                        <div key={g.title + heading}>
                          <p className="px-5 pt-3 pb-1 text-2xs font-semibold tracking-[.12em] text-muted uppercase">
                            {heading}
                          </p>
                          {links.map(([label, href]) => (
                            <Link
                              key={label}
                              className="flex min-h-[44px] items-center px-5 text-[15px] text-ink hover:bg-paper"
                              href={href}
                            >
                              {label}
                            </Link>
                          ))}
                        </div>
                      )),
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <Link
            className="flex min-h-[56px] items-center border-b border-line px-5 text-[16px] font-semibold text-ink"
            href="/agents?view=agencies"
          >
            Find an Agency
          </Link>
          <div className="h-2 border-b border-line bg-paper" />
          <Link className="flex min-h-[52px] items-center border-b border-line px-5 text-[15px] text-ink" href="/sell">
            List a Property
          </Link>
          <Link className="flex min-h-[52px] items-center border-b border-line px-5 text-[15px] text-ink" href="/saved">
            Saved properties
          </Link>
          <Link className="flex min-h-[52px] items-center border-b border-line px-5 text-[15px] text-ink" href="/help">
            Help &amp; contact
          </Link>
        </nav>
        <div className="grid shrink-0 gap-2 border-t border-line p-5">
          {!user ? (
            <>
              <button type="button" className="btn btn-dark btn-lg w-full" onClick={() => { onClose(); onSignIn?.(); }}>
                Sign In
              </button>
              <Link href="/register" className="btn btn-outline btn-lg w-full" onClick={onClose}>
                Create an account
              </Link>
            </>
          ) : (
            <>
              <Link
                href={role === 'buyer' ? '/saved' : '/dashboard'}
                className="btn btn-dark btn-lg w-full"
                onClick={onClose}
              >
                {role === 'buyer' ? 'My saved properties' : 'Open my dashboard'}
              </Link>
              <button
                type="button"
                className="btn btn-outline btn-lg w-full"
                onClick={() => {
                  signOut();
                  onClose();
                  router.push('/');
                }}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Marketplace header: mega menu (hover, click, keyboard), centred logo, account menu and mobile accordion drawer. */
export function MarketHeader() {
  const { user, role, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [current, setCurrent] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [authChoiceOpen, setAuthChoiceOpen] = useState(false);
  const [buyerSignupOpen, setBuyerSignupOpen] = useState(false);
  const headerRef = useRef(null);
  const timers = useRef<{ close?: ReturnType<typeof setTimeout>; hover?: ReturnType<typeof setTimeout> }>({});
  const canHover = useRef(false);

  const open = useCallback((key, focusFirst = undefined) => {
    setCurrent(key);
    if (focusFirst) setTimeout(() => (document.querySelector('#mega-' + key + ' a') as HTMLElement)?.focus(), 0);
  }, []);
  const close = useCallback((returnFocus) => {
    setCurrent((key) => {
      if (key && returnFocus)
        setTimeout(() => (document.querySelector('[data-mega-trigger="' + key + '"]') as HTMLElement)?.focus(), 0);
      return null;
    });
  }, []);

  useEffect(() => {
    canHover.current = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  }, []);
  // Close menus on navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setCurrent(null);
    setMobile(false);
  }
  useEffect(() => {
    if (!current) return undefined;
    const onDoc = (e) => !headerRef.current?.contains(e.target) && close(false);
    const onKey = (e) => e.key === 'Escape' && close(true);
    const onResize = () => window.innerWidth < 1280 && close(false);
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [current, close]);

  const trigger = (key) => (
    <button
      key={key}
      type="button"
      className="hdr-link"
      data-mega-trigger={key}
      aria-expanded={current === key}
      aria-controls={'mega-' + key}
      onClick={() => (current === key ? close(false) : open(key))}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          open(key, true);
        }
      }}
      onMouseEnter={() => {
        if (!canHover.current) return;
        clearTimeout(timers.current.close);
        clearTimeout(timers.current.hover);
        timers.current.hover = setTimeout(() => open(key), current ? 0 : 90);
      }}
      onMouseLeave={() => clearTimeout(timers.current.hover)}
    >
      {MEGA[key].label}
      <Icon name="chevron-down" className="hdr-chev h-3.5 w-3.5" />
    </button>
  );
  const closeMobile = useCallback(() => setMobile(false), []);
  const openAuthChoice = useCallback(() => setAuthChoiceOpen(true), []);
  const openBuyerSignup = useCallback(() => {
    setAuthChoiceOpen(false);
    setBuyerSignupOpen(true);
  }, []);
  const openProfessionalLogin = useCallback(() => {
    setAuthChoiceOpen(false);
    router.push('/login');
  }, [router]);
  const plainHover = () => canHover.current && close(false);
  const panelKeys = (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const links = [...e.currentTarget.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
  };

  return (
    <>
      <header
        ref={headerRef}
        className="mkt-header"
        onMouseLeave={() => {
          if (!canHover.current) return;
          clearTimeout(timers.current.hover);
          timers.current.close = setTimeout(() => close(false), 160);
        }}
        onMouseEnter={() => clearTimeout(timers.current.close)}
        onBlur={(e) => current && e.relatedTarget && !headerRef.current.contains(e.relatedTarget) && close(false)}
      >
        <div className="wrap grid h-full grid-cols-[1fr_auto_1fr] items-center gap-4">
          <nav className="-ml-3 hidden items-center xl:flex" aria-label="Primary">
            {LEFT_MENUS.map(trigger)}
            <Link className="hdr-link" href="/agents?view=agencies" onMouseEnter={plainHover}>
              Find an Agency
            </Link>
          </nav>
          <div className="xl:hidden">
            <button
              type="button"
              className="btn btn-outline h-11 w-11 px-0"
              aria-controls="mobile-menu"
              aria-expanded={mobile}
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >
              <Icon name="list" />
            </button>
          </div>
          <Wordmark className="justify-self-center" />
          <div className="flex items-center justify-self-end">
            <div className="hidden items-center xl:flex">
              <Link className="hdr-link" href="/sell" onMouseEnter={plainHover}>
                List a Property
              </Link>
              {trigger('pros')}
              <Link className="hdr-link" href="/help" onMouseEnter={plainHover}>
                Help
              </Link>
            </div>
            {ready && user ? (
              <AccountMenu user={user} role={role} />
            ) : (
              <button type="button" className="btn btn-dark btn-sm ml-2 h-9" onClick={openAuthChoice}>
                Sign In
              </button>
            )}
          </div>
        </div>
        <div className="mega-wrap">{current && <MegaPanel id={current} onKeyDown={panelKeys} />}</div>
      </header>
      {current && <div className="mega-scrim" onClick={() => close(false)} />}
      <MobileMenu open={mobile} onClose={closeMobile} onSignIn={openAuthChoice} user={ready ? user : null} role={role} />
      <AuthChoiceModal open={authChoiceOpen} onClose={() => setAuthChoiceOpen(false)} onBuyer={openBuyerSignup} onProfessional={openProfessionalLogin} />
      <BuyerSignupModal open={buyerSignupOpen} onOpenChange={setBuyerSignupOpen} />
    </>
  );
}
