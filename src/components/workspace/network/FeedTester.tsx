'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { fmtNumber } from '@/lib/listingFormat';
import { copyText } from '@/lib/share';
import { cx } from '@/lib/utils';
import { FEED_PATH } from '@/lib/propertyFeed';

/*
 * In-page API tester for the property feed. It calls the real endpoint on this origin with the key the
 * broker pastes (kept in component state only), so requests count toward usage and the rate limit.
 */

type Result = { status: number; ms: number; remaining: string | null; body: any; url: string };

function statusClass(status: number) {
  if (status >= 200 && status < 300) return 'badge-ok';
  if (status === 429 || status === 404) return 'badge-warn';
  return 'badge-danger';
}

function priceText(p) {
  if (p.price?.onRequest || p.price?.amount == null) return 'Price on request';
  return 'AED ' + fmtNumber(p.price.amount) + (p.price.frequency ? ' / ' + (p.price.frequency === 'monthly' ? 'month' : 'year') : '');
}

export function FeedTester({ apiKey, onKeyChange, hasKey }) {
  const { toast } = useFeedback();
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<'preview' | 'json'>('preview');

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const url = origin + FEED_PATH;
  const curl = `curl "${url}" -H "Authorization: Bearer YOUR_API_KEY"`;

  const send = async (page = 1) => {
    const target = url + (page > 1 ? '?page=' + page : '');
    setBusy(true);
    const started = performance.now();
    try {
      const response = await fetch(target, {
        cache: 'no-store',
        credentials: 'omit',
        headers: apiKey.trim() ? { Authorization: 'Bearer ' + apiKey.trim() } : {},
      });
      const body = await response.json().catch(() => ({ error: 'The response was not JSON.' }));
      setResult({
        status: response.status,
        ms: Math.round(performance.now() - started),
        remaining: response.headers.get('X-RateLimit-Remaining'),
        body,
        url: target,
      });
    } catch (error) {
      setResult({ status: 0, ms: Math.round(performance.now() - started), remaining: null, body: { error: (error as Error).message }, url: target });
    } finally {
      setBusy(false);
    }
  };

  const copy = (text, label) =>
    copyText(text).then(
      () => toast(label + ' copied.'),
      () => toast('Select the text and copy it manually.', { icon: 'exclamation-circle' }),
    );

  const items = result?.body?.data ? (Array.isArray(result.body.data) ? result.body.data : [result.body.data]) : [];
  const meta = result?.body?.meta;

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="feed-tester-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="feed-tester-title" className="text-[15px] font-semibold text-ink">
            Test the API
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Send a real request with your key and see exactly what your website will receive. Test calls count toward
            your usage and rate limit.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className="label text-2xs" htmlFor="ft-key">
          API key
        </label>
        <div className="flex gap-2">
          <input
            id="ft-key"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            className="input input-sm h-9 flex-1 font-mono text-[12px]"
            placeholder={hasKey ? 'Paste your API key (e08_live_…)' : 'Generate an API key above first'}
            value={apiKey}
            onChange={(e) => onKeyChange(e.target.value)}
          />
          <button type="button" className="btn btn-outline btn-sm h-9" onClick={() => setShowKey(!showKey)} aria-pressed={showKey}>
            <Icon name={showKey ? 'eye-slash' : 'eye'} />
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="hint">The key is used only in this tab and is not saved. Leave it empty to test the 401 response.</p>
      </div>

      <div className="mt-3 rounded border border-line bg-mist/40 p-2">
        <div className="flex items-center gap-2">
          <span className="badge badge-dark">GET</span>
          <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink" title={url}>
            {url}
          </code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(curl, 'curl command')}>
            <Icon name="terminal" />
            Copy curl
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-dark btn-sm" disabled={busy} onClick={() => send()}>
          <Icon name={busy ? 'hourglass-split' : 'send'} />
          {busy ? 'Sending…' : 'Send request'}
        </button>
        {result && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResult(null)}>
            Clear result
          </button>
        )}
      </div>

      {result && (
        <div className="mt-4 border-t border-line pt-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <span className={cx('badge', statusClass(result.status))}>{result.status || 'Network error'}</span>
            <span className="text-muted">{fmtNumber(result.ms)} ms</span>
            {meta && (
              <span className="text-muted">
                {fmtNumber(meta.total)} total · page {meta.page} of {meta.pages}
              </span>
            )}
            {result.remaining !== null && <span className="text-muted">{result.remaining} requests left this minute</span>}
            <span className="ml-auto flex gap-2">
              <span className="seg" role="group" aria-label="Response view">
                <button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>
                  Preview
                </button>
                <button type="button" aria-pressed={view === 'json'} onClick={() => setView('json')}>
                  JSON
                </button>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(JSON.stringify(result.body, null, 2), 'Response')}>
                <Icon name="clipboard" />
                Copy
              </button>
            </span>
          </div>

          {result.body?.error && (
            <div className="mt-3 rounded border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
              <p className="font-semibold">{result.body.error}</p>
              {Array.isArray(result.body.details) && (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {result.body.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {view === 'json' ? (
            <pre className="mt-3 max-h-[420px] overflow-auto rounded bg-ink p-3 font-mono text-[12px] leading-[1.55] text-white">
              {JSON.stringify(result.body, null, 2)}
            </pre>
          ) : items.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((p) => (
                <div key={p.id} className="flex gap-3 rounded border border-line p-2">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded bg-mist">
                    {p.featuredImage && <img src={p.featuredImage} alt="" className="img-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0 text-xs">
                    <p className="truncate text-[13px] font-semibold text-ink">{p.title}</p>
                    <p className="truncate text-muted">
                      {[p.location?.area, p.location?.emirate].filter(Boolean).join(', ')} · {p.type} ·{' '}
                      {p.bedrooms === 0 ? 'Studio' : p.bedrooms != null ? p.bedrooms + ' bed' : '—'}
                    </p>
                    <p className="font-semibold text-ink">{priceText(p)}</p>
                    <p className="truncate font-mono text-2xs text-muted">
                      {p.id}
                      {p.reference ? ' · ' + p.reference : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !result.body?.error && <p className="mt-3 text-[13px] text-muted">No properties in this response.</p>
          )}

          {meta && meta.pages > 1 && view === 'preview' && (
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" disabled={busy || meta.page <= 1} onClick={() => send(meta.page - 1)}>
                <Icon name="chevron-left" />
                Previous
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy || meta.page >= meta.pages} onClick={() => send(meta.page + 1)}>
                Next
                <Icon name="chevron-right" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
