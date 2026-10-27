'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { cx } from '@/lib/utils';
import { mediaDisplayURL } from '@/lib/mediaURL';

/**
 * Fullscreen photo viewer with keyboard (←/→/Esc), swipe and thumbnails.
 * `items` = [{ src, caption }]; render with `open` and `start`, close via `onClose`.
 */
export function Lightbox({ open, items = [], start = 0, title, onClose }) {
  const [i, setI] = useState(start);
  const [prevKey, setPrevKey] = useState(null);
  const closeRef = useRef(null);
  const x0 = useRef(null);
  const n = items.length;

  const key = open ? `${start}:${n}` : null;
  if (key !== prevKey) {
    setPrevKey(key);
    if (open) setI(start);
  }

  useEffect(() => {
    if (!open) return undefined;
    const last = document.activeElement;
    document.documentElement.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI((v) => (v + 1) % n);
      else if (e.key === 'ArrowLeft') setI((v) => (v - 1 + n) % n);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
      (last as HTMLElement)?.focus?.();
    };
  }, [open, n, onClose]);

  if (!open || !n || typeof document === 'undefined') return null;
  const it = items[Math.min(i, n - 1)];
  const go = (k) => setI((k + n) % n);

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      onTouchStart={(e) => (x0.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (x0.current == null) return;
        const dx = e.changedTouches[0].clientX - x0.current;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        x0.current = null;
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 text-white sm:px-6">
        <p className="min-w-0 truncate text-[13px]">{title}</p>
        <div className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums">
            {i + 1} / {n}
          </span>
          <button ref={closeRef} type="button" className="lb-btn" onClick={onClose} aria-label="Close gallery">
            <Icon name="x-lg" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
        <img
          src={mediaDisplayURL(it.src)}
          alt={it.caption || `Photo ${i + 1}`}
          className="max-h-full max-w-full object-contain select-none"
        />
        {n > 1 && (
          <>
            <button
              type="button"
              className="lb-btn lb-nav left-2 sm:left-4"
              onClick={() => go(i - 1)}
              aria-label="Previous photo"
            >
              <Icon name="chevron-left" />
            </button>
            <button
              type="button"
              className="lb-btn lb-nav right-2 sm:right-4"
              onClick={() => go(i + 1)}
              aria-label="Next photo"
            >
              <Icon name="chevron-right" />
            </button>
          </>
        )}
      </div>
      <p className="px-4 py-2 text-center text-[13px] text-white/80">{it.caption || ''}</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 sm:justify-center">
        {items.map((t, k) => (
          <button
            key={k}
            type="button"
            className={cx('lb-thumb', k === i && 'is-active')}
            onClick={() => go(k)}
            aria-label={`Show photo ${k + 1}`}
          >
            <img src={mediaDisplayURL(t.src)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
