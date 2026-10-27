'use client';

import Link from 'next/link';

/** Props that make a link/button inert in the editor preview (old `{ preview: true }`). */
export function inertProps(preview) {
  return preview ? { tabIndex: -1, 'aria-disabled': true, onClick: (e) => e.preventDefault() } : {};
}

/** Internal link that becomes an inert `href="#"` anchor in preview mode. */
export function PLink({ preview, href, children, ...rest }) {
  if (preview)
    return (
      <a href="#" {...rest} {...inertProps(true)}>
        {children}
      </a>
    );
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

/** Splits user text on blank lines into paragraphs, single newlines into <br> (old nl2p). */
export function Paras({ text, className = '' }) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p, i) => (
      <p key={i} className={className}>
        {p.split('\n').map((line, k) => (
          <span key={k}>
            {k > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    ));
}

/** Photos in display order (featured first) with captions from `l.photos`. */
export function photoItems(l) {
  return (l.images || []).map((src) => {
    const p = (l.photos || []).find((x) => x.src === src);
    return { ...(p || {}), src, caption: (p && p.caption) || '' };
  });
}

export const isClosed = (l) => l.status === 'sold' || l.status === 'rented';

/** Location line used in the header and the map section. */
export function locationOf(l) {
  const off = l.completion === 'offplan';
  return [l.building || (off && (l.offplan || {}).project), l.area, l.emirate].filter(Boolean).join(', ');
}
