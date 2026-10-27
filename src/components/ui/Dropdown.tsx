'use client';

import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/utils';

/** Simple disclosure menu: `button` renders the trigger (receives props), children render the menu (receives close). */
export function Dropdown({ button, children, align = 'right', menuClassName = undefined, className = undefined }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
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
  const close = () => setOpen(false);
  return (
    <div className={cx('relative', className)} ref={ref}>
      {button({ 'aria-expanded': open, 'aria-haspopup': 'menu', onClick: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={cx(
            'absolute top-full z-50 mt-1 rounded-lg border border-line bg-white p-1 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName || 'w-56',
          )}
          role="menu"
          onClick={(e) => (e.target as Element).closest('a,button') && close()}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}
