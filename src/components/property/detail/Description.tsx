'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Paras } from './shared';

/** 04a — summary, description with Read more, key points, off-plan project text and references. */
export function Description({ listing: l }) {
  const [open, setOpen] = useState(false);
  const off = l.completion === 'offplan';
  const o = l.offplan || {};
  const desc = l.description || 'No description yet.';
  const long = desc.length > 420;
  const points = l.keyPoints ? String(l.keyPoints).split(/\n+/).filter(Boolean) : [];

  return (
    <section aria-labelledby="h-desc">
      <h2 id="h-desc" className="h3">
        Description
      </h2>
      {l.summary && <p className="mt-3 text-[15px] leading-[1.6] font-medium text-ink">{l.summary}</p>}
      <div
        id="prop-desc"
        className={
          'readmore mt-3 space-y-3 text-[14px] leading-[1.75] text-text' + (long && !open ? ' is-clamped' : '')
        }
      >
        <Paras text={desc} />
      </div>
      {long && (
        <button
          type="button"
          className="mt-2 text-[13px] font-semibold text-ink underline underline-offset-4"
          aria-expanded={open}
          aria-controls="prop-desc"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Read less' : 'Read more'}
        </button>
      )}
      {!!points.length && (
        <ul className="mt-4 space-y-1.5 text-[14px] text-text">
          {points.map((k, i) => (
            <li key={i} className="flex items-start gap-2">
              <Icon name="check2" className="mt-0.5 h-4 w-4 text-sage-ink" />
              {k}
            </li>
          ))}
        </ul>
      )}
      {off && o.projectDesc && (
        <div className="mt-5 rounded-lg bg-mist p-4">
          <p className="text-[13px] font-semibold text-ink">About the project</p>
          <div className="mt-1 space-y-2 text-[14px] leading-[1.65] text-text">
            <Paras text={o.projectDesc} />
          </div>
          {o.developerHighlights && (
            <>
              <p className="mt-3 text-[13px] font-semibold text-ink">Developer highlights</p>
              <div className="mt-1 text-[14px] leading-[1.65] text-text">
                <Paras text={o.developerHighlights} />
              </div>
            </>
          )}
        </div>
      )}
      <p className="mt-4 text-[13px] text-muted">
        Emirate08 reference: <span className="font-semibold text-ink">{l.ref || '—'}</span>
        {l.permit?.number && (
          <>
            {' · Advertising permit: '}
            <span className="font-semibold text-ink">{l.permit.number}</span>
          </>
        )}
      </p>
    </section>
  );
}

/** 04b — highlight chips. */
export function Highlights({ listing: l }) {
  if (!l.highlights?.length) return null;
  return (
    <section className="mt-8" aria-labelledby="h-hl">
      <h2 id="h-hl" className="h3">
        Highlights
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {l.highlights.map((h) => (
          <span key={h} className="hl-chip">
            <Icon name="stars" className="h-3.5 w-3.5" />
            {h}
          </span>
        ))}
      </div>
    </section>
  );
}
