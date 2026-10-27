'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/utils';

let openCount = 0;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: portal, backdrop, Escape to close, focus trap and focus restore.
 * `panelClassName` extends the default `.modal-panel` styles.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  role = 'dialog',
  panelClassName,
  children,
  initialFocus = undefined,
  closeOnEsc = true,
  as: Panel = 'div',
  panelProps = undefined,
}) {
  const panelRef = useRef(null);
  const lastFocus = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    openCount += 1;
    document.documentElement.style.overflow = 'hidden';
    const panel = panelRef.current;
    panel?.animate?.(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 240,
        easing: 'cubic-bezier(.22,.61,.36,1)',
      },
    );
    const t = setTimeout(() => {
      const target = (initialFocus && panel?.querySelector(initialFocus)) || panel?.querySelector(FOCUSABLE);
      target?.focus();
    }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape' && closeOnEsc) {
        e.stopPropagation();
        onCloseRef.current?.();
      }
      if (e.key === 'Tab' && panel) {
        const f = [...panel.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      openCount = Math.max(0, openCount - 1);
      if (!openCount) document.documentElement.style.overflow = '';
      lastFocus.current?.focus?.();
    };
  }, [open, initialFocus, closeOnEsc]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal">
      <div className="modal-backdrop" onClick={() => onCloseRef.current?.()} />
      <Panel
        ref={panelRef}
        className={cx('modal-panel', panelClassName)}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        {...panelProps}
      >
        {children}
      </Panel>
    </div>,
    document.body,
  );
}
