'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { counts, data, deselect, fmtNumber, fmtPrice, log, network, plan, relTime, setNote } from '@/lib/store';
import { cx } from '@/lib/utils';
import { ContactModal, SpecLine, agencyOf, netUrl } from './NetworkBits';

const BLANK = { avail: 'all', purpose: 'all', search: '' };

function NoteField({ id, note }) {
  const [status, setStatus] = useState('');
  const timer = useRef(null);
  const pending = useRef(null);
  /* flush an unsaved note if the row unmounts (navigation, filter change) before the debounce fires */
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current != null) setNote(id, pending.current);
    },
    [id],
  );
  return (
    <div className="field mt-3">
      <label className="sr-only" htmlFor={'note-' + id}>
        Private notes
      </label>
      <textarea
        id={'note-' + id}
        className="textarea min-h-[64px] text-[13px]"
        placeholder="Private notes — only you can see these"
        defaultValue={note}
        onChange={(e) => {
          const v = e.target.value;
          setStatus('Saving…');
          pending.current = v;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            pending.current = null;
            setNote(id, v);
            setStatus('Saved on this device');
          }, 450);
        }}
      />
      <p className="mt-1 h-4 text-2xs text-muted" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

/** Private collection of selected network properties with notes (old selected.html + network.js selected part). */
export function Selected() {
  useStoreVersion();
  const { toast, confirm } = useFeedback();
  const [f, setF] = useState(BLANK);
  const [searchText, setSearchText] = useState('');
  const [contactId, setContactId] = useState(null);

  useEffect(() => {
    const t = setTimeout(
      () => setF((cur) => (cur.search === searchText.trim() ? cur : { ...cur, search: searchText.trim() })),
      150,
    );
    return () => clearTimeout(t);
  }, [searchText]);

  const d = data();
  const p = plan();
  const c = counts();
  const unavailable = d.selected.filter((s) => {
    const n = network(s.id);
    return n && !n.available;
  }).length;
  const rows = d.selected
    .map((s) => ({ s, n: network(s.id) }))
    .filter(({ s, n }) => {
      if (!n) return false;
      if (f.avail === 'available' && !n.available) return false;
      if (f.avail === 'unavailable' && n.available) return false;
      if (f.purpose !== 'all' && n.purpose !== f.purpose) return false;
      if (
        f.search &&
        (n.title + ' ' + n.area + ' ' + n.broker.name + ' ' + agencyOf(n) + ' ' + s.note)
          .toLowerCase()
          .indexOf(f.search.toLowerCase()) === -1
      )
        return false;
      return true;
    })
    .sort((a, b) => new Date(b.s.addedAt).getTime() - new Date(a.s.addedAt).getTime());

  const remove = async (n, s) => {
    const ok = await confirm({
      title: 'Remove from Selected?',
      body:
        '“' +
        n.title +
        '” will be removed' +
        (s && s.note ? ' together with your private notes' : '') +
        '. This frees one selection slot.',
      ok: 'Remove',
      danger: true,
    });
    if (!ok) return;
    deselect(n.id);
    log('Removed “' + n.title + '” from Selected Properties', 'bookmark-dash');
    toast('Removed from Selected Properties.', { icon: 'bookmark-dash' });
  };
  const resetFilters = () => {
    setF(BLANK);
    setSearchText('');
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h2 text-[24px] lg:text-[28px]">Selected Properties</h1>
          <p className="mt-1 text-[14px] text-muted">Keep important network listings organised for follow-up.</p>
        </div>
        <Link href="/network" className="btn btn-outline">
          <Icon name="plus-lg" />
          Add from network
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4 sm:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Slot usage</p>
              <p className="mt-1 font-display text-[24px] leading-none font-semibold text-ink">
                {c.selected} <span className="text-[15px] font-normal text-muted">/ {fmtNumber(p.selections)}</span>
              </p>
            </div>
            <Link href="/subscription" className="arrow-link text-xs">
              Need more slots?
              <Icon name="arrow-right" />
            </Link>
          </div>
          <div className="meter mt-3">
            <span style={{ width: Math.min(100, (c.selected / p.selections) * 100) + '%' }} />
          </div>
          <p className="mt-2 text-2xs text-muted">
            {fmtNumber(Math.max(0, p.selections - c.selected))} slots remaining on {p.name}
          </p>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mist">
            <Icon name="slash-circle" className="h-4 w-4 text-ink" />
          </span>
          <div>
            <p className="text-xs text-muted">Availability</p>
            <p className="text-[13px] font-semibold text-ink">
              {unavailable ? unavailable + ' no longer available' : 'All available'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3">
        <div className="seg" role="group" aria-label="Availability">
          {[
            ['all', 'All'],
            ['available', 'Available'],
            ['unavailable', 'Unavailable'],
          ].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={f.avail === v} onClick={() => setF({ ...f, avail: v })}>
              {l}
            </button>
          ))}
        </div>
        <label htmlFor="sf-purpose" className="sr-only">
          Purpose
        </label>
        <select
          id="sf-purpose"
          className="select input-sm h-9 w-auto min-w-[130px]"
          value={f.purpose}
          onChange={(e) => setF({ ...f, purpose: e.target.value })}
        >
          <option value="all">Sale &amp; rent</option>
          <option value="sale">For sale</option>
          <option value="rent">For rent</option>
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <label htmlFor="sf-search" className="sr-only">
            Search selected properties and notes
          </label>
          <input
            id="sf-search"
            type="search"
            className="input input-sm h-9 pl-9"
            placeholder="Search properties, brokers or notes"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3" aria-live="polite">
        {rows.length ? (
          rows.map(({ s, n }) => {
            const gone = !n.available;
            return (
              <article key={n.id} className="card flex flex-col gap-4 p-4 md:flex-row">
                <Link
                  href={netUrl(n.id)}
                  className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded md:w-[200px]"
                >
                  <img
                    src={n.images[0]}
                    alt=""
                    className={cx('img-cover', gone && 'opacity-70 grayscale')}
                    loading="lazy"
                  />
                  <span className="demo-tag absolute bottom-2 left-2">Illustrative</span>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold text-ink">
                        <Link href={netUrl(n.id)} className="hover:underline">
                          {n.title}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-xs text-muted">
                        {n.area}, {n.emirate} · <SpecLine n={n} />
                      </p>
                    </div>
                    {gone ? (
                      <span className="badge badge-muted">
                        <Icon name="slash-circle" className="h-3 w-3" />
                        No longer available
                      </span>
                    ) : (
                      <span className="badge badge-ok">
                        <span className="dot" />
                        Available
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span
                      className={cx(
                        'font-display text-[15px] font-semibold text-ink',
                        gone && 'line-through decoration-muted',
                      )}
                    >
                      {fmtPrice(n)}
                    </span>
                    <span className="text-muted">
                      Source: <span className="font-semibold text-ink">{n.broker.name}</span>, {agencyOf(n)}
                    </span>
                    <span className="text-muted">Selected {relTime(s.addedAt).toLowerCase()}</span>
                  </div>
                  {gone && (
                    <p className="mt-2 text-xs text-muted">
                      The listing broker has withdrawn or closed this listing. Your private notes are kept until you
                      remove it.
                    </p>
                  )}
                  <NoteField id={n.id} note={s.note} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={netUrl(n.id)} className="btn btn-outline btn-sm">
                      View details
                    </Link>
                    {!gone && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setContactId(n.id)}>
                        <Icon name="chat-square-text" />
                        Contact broker
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => remove(n, s)}>
                      <Icon name="trash3" />
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : d.selected.length ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="font-display text-[16px] font-semibold text-ink">Nothing matches these filters</p>
            <button type="button" className="btn btn-outline btn-sm mt-4" onClick={resetFilters}>
              Show all selected
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <Icon name="bookmark" className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-3 font-display text-[16px] font-semibold text-ink">Your collection is empty</p>
            <p className="mt-1 text-[13px] text-muted">
              Select properties from the broker network to keep them here with private notes.
            </p>
            <Link href="/network" className="btn btn-dark btn-sm mt-4">
              Browse the network
            </Link>
          </div>
        )}
      </div>
      <ContactModal id={contactId} onClose={() => setContactId(null)} />
    </div>
  );
}
