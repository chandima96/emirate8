'use client';

import { Icon } from '@/components/ui/Icon';
import { STATUS } from '@/config/reference';
import { isHistory, isPublic, photoOf } from '@/lib/store';

/** Status badge for a broker's own listing (draft · pending · published · unpublished · sold · rented · archived). */
export function StatusBadge({ listing: l }) {
  const s = STATUS[l.status] || STATUS.draft;
  return <span className={'badge ' + s.cls}>{s.label}</span>;
}

/** Public / portfolio history / hidden indicator. */
export function VisBadge({ listing: l }) {
  if (isPublic(l))
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-ok">
        <Icon name="eye" className="h-3.5 w-3.5" />
        Public
      </span>
    );
  if (isHistory(l))
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-muted">
        <Icon name="clock-history" className="h-3.5 w-3.5" />
        Portfolio history
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-muted">
      <Icon name="eye-slash" className="h-3.5 w-3.5" />
      Hidden
    </span>
  );
}

/** Featured-photo thumbnail with an empty placeholder. */
export function Thumb({ listing, className }) {
  const src = photoOf(listing);
  return src ? (
    <img src={src} alt="" className={className + ' object-cover'} loading="lazy" />
  ) : (
    <span className={className + ' flex items-center justify-center bg-mist'}>
      <Icon name="image" className="h-4 w-4 text-muted" />
    </span>
  );
}

/** User text → paragraphs on blank lines, <br> on single newlines (old render.nl2p). */
export function Paragraphs({ text, className = undefined }) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p, i) => (
      <p key={i} className={className}>
        {p.split('\n').map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    ));
}
