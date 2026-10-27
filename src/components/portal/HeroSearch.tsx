'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

const TABS = [
  ['sale', 'Buy'],
  ['rent', 'Rent'],
  ['', 'All'],
];
const TAB_CLS =
  'rounded bg-white px-4 py-1.5 text-[13px] font-semibold text-ink aria-[selected=false]:bg-transparent aria-[selected=false]:text-white aria-[selected=false]:hover:bg-white/15';

/** Homepage hero: Buy / Rent / All tabs and the search box → /properties. */
export function HeroSearch() {
  const router = useRouter();
  const [purpose, setPurpose] = useState('sale');
  const [q, setQ] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (purpose) params.set('purpose', purpose);
    if (q.trim()) params.set('q', q.trim());
    const s = params.toString();
    router.push('/properties' + (s ? '?' + s : ''));
  };
  return (
    <>
      <div className="mb-3 flex justify-center gap-1" role="tablist" aria-label="Search for">
        {TABS.map(([v, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={purpose === v}
            className={TAB_CLS}
            onClick={() => setPurpose(v)}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        className="flex h-14 items-center rounded-lg bg-white pr-1.5 pl-5 shadow-pop sm:h-16"
        role="search"
        onSubmit={submit}
      >
        <label htmlFor="hero-q" className="sr-only">
          Community, building or property type
        </label>
        <input
          id="hero-q"
          type="search"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-hidden sm:text-[16px]"
          placeholder="Enter a community, building or property type"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-ink text-white hover:bg-ink-deep sm:h-12 sm:w-12"
          aria-label="Search"
        >
          <Icon name="search" className="h-5 w-5" />
        </button>
      </form>
    </>
  );
}
