'use client';

import { Fragment, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { AgentCard, AgencyCard } from '@/components/broker/AgentCard';
import { CardSkeletons } from '@/components/ui/CardSkeletons';
import { useSession } from '@/components/providers/SessionProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { agencies, brokers } from '@/lib/store';
import { EmptyState } from './EmptyState';

/** Agent & agency directory: search by location or name, Agents / Agencies switch, “View more” paging (4 at a time). */
export function Directory({ heroImage }) {
  const { ready } = useSession();
  useStoreVersion();
  const sp = useSearchParams();
  const viewParam = sp.get('view') === 'agencies' ? 'agencies' : 'agents';
  const [view, setView] = useState(viewParam);
  /* Follow ?view= when the header links change it while this page is open. */
  const [seenView, setSeenView] = useState(viewParam);
  if (seenView !== viewParam) {
    setSeenView(viewParam);
    setView(viewParam);
  }
  const [by, setBy] = useState('location');
  const [input, setInput] = useState(sp.get('q') || '');
  const [q, setQ] = useState(sp.get('q') || '');
  const [limit, setLimit] = useState(4);
  const inputRef = useRef(null);

  const noun = view === 'agents' ? 'agents' : 'agencies';
  const t = q.toLowerCase();
  const all = ready
    ? (view === 'agents' ? brokers() : agencies())
        .filter((x) => !t || (by === 'name' ? x.name : x.areas.join(' ')).toLowerCase().indexOf(t) > -1)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const shown = all.slice(0, limit);

  const help = (
    <aside className="on-dark flex flex-col justify-center gap-3 rounded-lg bg-ink p-7">
      <Icon name="chat-square-text" className="h-6 w-6 text-sage" />
      <h3 className="font-display text-[21px] font-semibold text-white">
        Need help finding the right {view === 'agents' ? 'agent' : 'agency'}?
      </h3>
      <p className="text-[14px] leading-[1.6] text-[#A9B4B1]">
        Start with the community you’re interested in — professionals who list there know its buildings, service charges
        and pricing.
      </p>
      <Link href="/properties" className="mt-1 text-[14px] font-semibold text-sage underline underline-offset-4">
        Browse properties by community
      </Link>
    </aside>
  );

  return (
    <>
      <section className="border-b border-line bg-white" aria-labelledby="dir-hero">
        <div className="wrap grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1fr_440px] lg:gap-14">
          <div>
            <p className="eyebrow">Find an agent</p>
            <h1 id="dir-hero" className="h1 mt-4 max-w-[620px]">
              A real estate professional <em className="f font-normal">who knows your community</em>
            </h1>
            <p className="lead mt-4 max-w-[520px]">
              Search by community or by name. Every profile shows the broker’s registration number, agency and current
              listings.
            </p>
            <div className="mt-7 max-w-[600px]">
              <div className="flex border-b border-line" role="tablist" aria-label="Search by">
                {[
                  ['location', 'Location'],
                  ['name', 'Name'],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className="tab text-[14px]"
                    role="tab"
                    aria-selected={by === k}
                    aria-controls="dir-form"
                    onClick={() => {
                      setBy(k);
                      inputRef.current?.focus();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <form
                id="dir-form"
                className="mt-4 flex h-14 items-center rounded-lg border border-line bg-white pr-1.5 pl-4 focus-within:border-ink"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQ(input.trim());
                  setLimit(4);
                  document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span className="flex shrink-0 text-muted" aria-hidden="true">
                  <Icon name={by === 'location' ? 'geo-alt' : 'person'} className="h-5 w-5" />
                </span>
                <label htmlFor="dir-q" className="sr-only">
                  Community or name
                </label>
                <input
                  ref={inputRef}
                  id="dir-q"
                  type="search"
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] focus:outline-hidden"
                  placeholder={
                    by === 'location'
                      ? 'Community or area, e.g. Dubai Marina'
                      : view === 'agents'
                        ? 'Agent name'
                        : 'Agency name'
                  }
                  autoComplete="off"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button type="submit" className="btn btn-dark h-11">
                  Search
                </button>
              </form>
            </div>
          </div>
          {heroImage}
        </div>
      </section>
      <section id="results" className="wrap scroll-mt-24 py-10 sm:py-12" aria-labelledby="dir-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="dir-title" className="h3">
              {view === 'agents' ? 'Real estate agents in Dubai' : 'Real estate agencies in Dubai'}
            </h2>
            <p className="mt-1 text-[13px] text-muted" aria-live="polite">
              {ready ? `Showing ${shown.length} of ${all.length} ${noun}` : ''}
            </p>
          </div>
          <div className="seg" role="group" aria-label="Show">
            {[
              ['agents', 'Agents'],
              ['agencies', 'Agencies'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={view === k}
                onClick={() => {
                  setView(k);
                  setLimit(4);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {!ready && <CardSkeletons count={4} variant="agent" />}
          {ready &&
            (shown.length ? (
              shown.map((x, i) => (
                <Fragment key={x.id}>
                  {view === 'agents' ? <AgentCard broker={x} /> : <AgencyCard agency={x} />}
                  {i === 0 && help}
                </Fragment>
              ))
            ) : (
              <EmptyState title={`No ${noun} match “${q}”`} text="Try another community or name." />
            ))}
        </div>
        <div className="mt-8 text-center">
          {all.length > shown.length && (
            <button type="button" className="btn btn-outline" onClick={() => setLimit((l) => l + 4)}>
              View more {noun}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
