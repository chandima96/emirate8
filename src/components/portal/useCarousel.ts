'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Horizontal scroll-snap carousel: a track ref plus prev/next handlers whose disabled state follows the scroll position. */
export function useCarousel(dep) {
  const track = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const sync = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const start = t.scrollLeft <= 4;
    const end = t.scrollLeft + t.clientWidth >= t.scrollWidth - 4;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    const t = track.current;
    if (!t) return undefined;
    t.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    const raf = requestAnimationFrame(sync);
    return () => {
      cancelAnimationFrame(raf);
      t.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  /* Content changed (new matches, data ready): back to the start and re-check the edges. */
  useEffect(() => {
    const t = track.current;
    if (!t) return undefined;
    t.scrollLeft = 0;
    const raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [dep, sync]);

  const step = (dir) => {
    const t = track.current;
    if (!t) return;
    const c = t.children[0];
    const w = c ? c.getBoundingClientRect().width + 16 : 300;
    t.scrollBy({ left: dir * w, behavior: 'smooth' });
  };

  return { track, prevDisabled: edges.start, nextDisabled: edges.end, prev: () => step(-1), next: () => step(1) };
}
