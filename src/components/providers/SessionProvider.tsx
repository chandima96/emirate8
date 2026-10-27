'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ensureSeed, refreshData, currentUser, role as roleOf } from '@/lib/store';
import { usePathname } from 'next/navigation';
import { useStoreVersion } from '@/hooks/useStore';

const SessionContext = createContext({ ready: false, user: null, role: 'guest' });

/** Loads the Supabase-backed session and exposes the signed-in user and role. */
export function SessionProvider({ children }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  useStoreVersion();

  useEffect(() => {
    let alive = true;
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

  useEffect(() => {
    if (!ready) return;
    const el = document.documentElement;
    if (role === 'guest') el.removeAttribute('data-role');
    else el.setAttribute('data-role', role);
  }, [ready, role]);

  return <SessionContext.Provider value={{ ready, user, role }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
