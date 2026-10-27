'use client';

import { useCallback, useEffect, useState } from 'react';

/* Small helpers shared by the workspace pages (overview, account, profile, subscription). */

export function credText(user) {
  return (
    {
      pending: ['Pending Review', 'badge-warn'],
      verified: ['Verified', 'badge-ok'],
      rejected: ['Action needed', 'badge-danger'],
    }[user.credentialStatus || 'pending'] || ['Pending Review', 'badge-warn']
  );
}

export function trialLeft(user) {
  return Math.max(0, Math.ceil((new Date(user.trialEnds).getTime() - Date.now()) / 864e5));
}

/* Activity entries store icon names from the old Lucide-era code; map them to Bootstrap Icons. */
const LEGACY = {
  'circle-check': 'check-circle',
  'circle-alert': 'exclamation-circle',
  'circle-x': 'x-circle',
  'message-square': 'chat-square-text',
  'trash-2': 'trash3',
  'file-pen-line': 'pencil-square',
  'shield-alert': 'shield-exclamation',
  'log-out': 'box-arrow-right',
  save: 'floppy',
  'refresh-cw': 'arrow-repeat',
  'bookmark-minus': 'bookmark-dash',
  'key-round': 'key',
  check: 'check-lg',
  'map-pin': 'geo-alt',
  x: 'x-lg',
  plus: 'plus-lg',
  play: 'play-fill',
  pause: 'pause-fill',
  mail: 'envelope',
  phone: 'telephone',
  'user-round': 'person',
  pencil: 'pencil-square',
};
export function bi(name) {
  return LEGACY[name] || name;
}

/** Splits user-entered text on blank lines / newlines into paragraphs rendered as React text. */
export function Paragraphs({ text, className = undefined }) {
  return String(text || '')
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p, i) => (
      <p key={i} className={className}>
        {p}
      </p>
    ));
}

const SECTION_RX = /^[a-z-]+$/;

/**
 * Hash-addressed section tabs (`/account#credentials`). Returns [current, go] where `go(t)` switches
 * the section and replaces the URL hash without scrolling.
 */
export function useHashTabs(tabs) {
  const pick = useCallback((h) => (tabs.indexOf(h) > -1 ? h : tabs[0]), [tabs]);
  const [tab, setTab] = useState(() => {
    const h = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
    return pick(SECTION_RX.test(h) ? h : '');
  });
  useEffect(() => {
    const on = () => setTab(pick(window.location.hash.slice(1)));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [pick]);
  const go = useCallback(
    (t) => {
      window.history.replaceState(window.history.state, '', '#' + t);
      setTab(pick(t));
    },
    [pick],
  );
  return [tab, go];
}

/** The section navigation used by Profile and Account (old `.wz-step` links). */
export function SectionNav({ label, items, current, onSelect }) {
  return (
    <nav
      className="no-scrollbar flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:gap-0.5 lg:self-start"
      aria-label={label}
    >
      {items.map(([key, icon, text]) => (
        <a
          key={key}
          href={'#' + key}
          className={
            'wz-step flex items-center gap-2.5 rounded px-3 py-2 text-[13px] whitespace-nowrap' +
            (current === key ? ' is-current' : '')
          }
          aria-current={current === key ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            onSelect(key);
          }}
        >
          <i className={'bi bi-' + icon + ' h-4 w-4'} aria-hidden="true" />
          {text}
        </a>
      ))}
    </nav>
  );
}

/** Toggle row used by account privacy / notification lists (label + `.toggle`). */
export function ToggleRow({ id, label, description, checked, onChange }) {
  return (
    <li className="flex items-center justify-between gap-4 p-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
      <span className="relative">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id} className="toggle" aria-hidden="true" />
      </span>
    </li>
  );
}
