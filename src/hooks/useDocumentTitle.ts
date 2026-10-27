'use client';

import { useEffect } from 'react';

/**
 * Sets document.title from client-side data and keeps it, even when Next's (streamed) route metadata
 * writes its own <title> after hydration. Pass a falsy value to leave the metadata title alone.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [title]);
}
