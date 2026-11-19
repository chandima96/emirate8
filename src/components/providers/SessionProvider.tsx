'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { ensureSeed, refreshData, currentUser, loadSessionUser, role as roleOf, userPhoto } from '@/lib/store';
import { usePathname } from 'next/navigation';
import { useStoreVersion } from '@/hooks/useStore';

/** The few account details the header needs, remembered so a reload shows the account straight away. */
type AccountHint = { id: string | number; name: string; type: string; photo: string };
const HINT_KEY = 'e8.account';

const hintListeners = new Set<() => void>();
let hintRaw: string | null | undefined;
let hintValue: AccountHint | null = null;

/** Snapshot for useSyncExternalStore: the same object until the stored value changes. */
function readHint(): AccountHint | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HINT_KEY);
  } catch {
    raw = null;
  }
  if (raw !== hintRaw) {
    hintRaw = raw;
    try {
      const value = JSON.parse(raw || 'null');
      hintValue = value && value.id != null && typeof value.name === 'string' ? value : null;
    } catch {
      hintValue = null;
    }
  }
  return hintValue;
}

function subscribeHint(listener: () => void) {
  hintListeners.add(listener);
  return () => {
    hintListeners.delete(listener);
  };
}

function writeHint(user) {
  try {
    if (!user) window.localStorage.removeItem(HINT_KEY);
    else {
      const hint: AccountHint = { id: user.id, name: user.name || '', type: user.type || '', photo: userPhoto(user) };
      window.localStorage.setItem(HINT_KEY, JSON.stringify(hint));
    }
  } catch {
    // Storage unavailable (private mode, blocked site data): the header just waits for the session.
  }
  hintListeners.forEach((listener) => listener());
}

type SessionValue = {
  /** The store (public catalogue and workspace data) has loaded. */
  ready: boolean;
  user: any;
  role: string;
  /** Who is signed in, known before `ready`: for headers and other account chrome. */
  account: any;
  accountRole: string;
  /** Whether `account` is settled yet; until then show a neutral placeholder, not "Sign in". */
  accountKnown: boolean;
};

const SessionContext = createContext<SessionValue>({
  ready: false,
  user: null,
  role: 'guest',
  account: null,
  accountRole: 'guest',
  accountKnown: false,
});

/** Loads the Supabase-backed session and exposes the signed-in user and role. */
export function SessionProvider({ children }) {
  const [ready, setReady] = useState(false);
  // The signed-in member before the whole store has loaded: the session answer once it arrives, and until
  // then the details remembered from the last visit (none during server rendering).
  const [early, setEarly] = useState<{ user: any; known: boolean }>({ user: null, known: false });
  const hint = useSyncExternalStore(subscribeHint, readHint, () => null);
  const pathname = usePathname();
  useStoreVersion();

  useEffect(() => {
    let alive = true;
    loadSessionUser()
      .then((user) => {
        if (!alive) return;
        setEarly({ user, known: true });
        writeHint(user);
      })
      .catch(() => alive && setEarly((current) => ({ ...current, known: true })));
    ensureSeed()
      .catch((error) => console.error('[session] Could not load Supabase session:', error))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let lastRefresh = Date.now();
    const refresh = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && now - lastRefresh >= 60_000) {
        lastRefresh = now;
        void refreshData().catch((error) => console.error('[session] Refresh failed:', error));
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ready, pathname]);

  const user = ready ? currentUser() : null;
  const role = ready ? roleOf(user) : 'guest';
  const account = ready ? user : early.known ? early.user : hint;
  const accountRole = roleOf(account);
  const accountKnown = ready || early.known || Boolean(hint);

  // Keep the remembered details current (sign-in, sign-out, a new profile photo).
  const hintKey = ready ? `${user?.id ?? ''}|${user?.name ?? ''}|${user?.type ?? ''}|${userPhoto(user)}` : null;
  useEffect(() => {
    if (hintKey !== null) writeHint(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintKey]);

  useEffect(() => {
    if (!accountKnown) return;
    const el = document.documentElement;
    if (accountRole === 'guest') el.removeAttribute('data-role');
    else el.setAttribute('data-role', accountRole);
  }, [accountKnown, accountRole]);

  return (
    <SessionContext.Provider value={{ ready, user, role, account, accountRole, accountKnown }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
