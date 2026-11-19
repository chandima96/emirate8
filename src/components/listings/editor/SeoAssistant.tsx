'use client';

import { useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { publicListing } from '@/lib/publicListing';
import { propertyFacts } from '@/lib/seoAgent/facts';
import { LIMITS, validateSeoDraft } from '@/lib/seoAgent/validate';

type Faq = { question: string; answer: string };
type Seo = { title: string; metaDescription: string; faq: Faq[]; generatedAt?: string };

/**
 * Search & AI visibility (Marketing › Title & description). Shows the SEO title, meta description and FAQ
 * the SEO assistant wrote for this listing, lets the broker edit them, and runs the assistant again.
 * The same check the public page uses runs as they type: content that quotes a number the listing no
 * longer has (e.g. after a price change) is flagged, and the page won't show it until it's fixed.
 */
export function SeoAssistant({ ed }) {
  const l = ed.L;
  const seo: Seo | null = l.seo && typeof l.seo === 'object' ? l.seo : null;
  const run = ed.seo || {};
  const problems = useMemo(
    () => (seo ? validateSeoDraft({ ...seo, faq: seo.faq || [], issues: [] }, propertyFacts(publicListing(l))) : []),
    [seo, l],
  );
  const setSeo = (patch: Partial<Seo>) => ed.set('seo', { ...seo, ...patch });
  const setFaq = (i: number, patch: Partial<Faq>) => setSeo({ faq: (seo?.faq || []).map((f, j) => (i === j ? { ...f, ...patch } : f)) });

  const generate = async () => {
    if (
      seo &&
      !(await ed.confirm({
        title: 'Write the SEO content again?',
        body: 'The SEO title, meta description and FAQ below will be replaced. A new listing title and description are offered for review in their fields; your text stays until you choose to use them.',
        ok: 'Generate SEO',
        cancel: 'Keep it',
      }))
    )
      return;
    run.run?.();
  };

  return (
    <section className="mt-6 rounded-lg border border-line p-4" aria-labelledby="seo-assistant">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h3 id="seo-assistant" className="text-[15px] font-semibold text-ink">
            Search &amp; AI visibility
          </h3>
          <p className="mt-1 text-xs text-muted">
            An SEO title, meta description and FAQ for search engines and AI assistants, written only from this
            listing’s details. It also suggests a clearer listing title and description for you to review. It runs
            after autofill and uses AI credits.
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" disabled={run.busy} onClick={generate}>
          <Icon name={run.busy ? 'hourglass-split' : 'stars'} />
          {run.busy ? 'Writing SEO…' : seo ? 'Regenerate SEO' : 'Generate SEO'}
        </button>
      </div>

      {run.error && (
        <p className="mt-3 text-[13px] text-warn" role="alert">
          {run.error}
        </p>
      )}

      {seo && (
        <div className="mt-4 space-y-4">
          {problems.length > 0 && (
            <div className="rounded-md border border-warn/40 bg-warn/5 p-3 text-[13px]" role="status">
              <p className="font-semibold text-ink">Not shown on the public page until this is fixed or regenerated:</p>
              <ul className="mt-1 list-disc pl-5 text-text">
                {problems.slice(0, 5).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="field block">
            <span className="label">
              SEO title <span className="opt">{(seo.title || '').length} / {LIMITS.title[1]}</span>
            </span>
            <input className="input" value={seo.title || ''} maxLength={LIMITS.title[1]} onChange={(e) => setSeo({ title: e.target.value })} />
          </label>
          <label className="field block">
            <span className="label">
              Meta description <span className="opt">{(seo.metaDescription || '').length} / {LIMITS.metaDescription[1]}</span>
            </span>
            <textarea
              className="textarea"
              rows={3}
              value={seo.metaDescription || ''}
              maxLength={LIMITS.metaDescription[1]}
              onChange={(e) => setSeo({ metaDescription: e.target.value })}
            />
          </label>
          <fieldset>
            <legend className="label">Questions buyers ask ({(seo.faq || []).length} / {LIMITS.faq[1]})</legend>
            <div className="mt-2 space-y-3">
              {(seo.faq || []).map((f, i) => (
                <div key={i} className="rounded-md border border-line p-3">
                  <div className="flex items-start gap-2">
                    <input
                      className="input flex-1"
                      aria-label={`Question ${i + 1}`}
                      value={f.question}
                      maxLength={LIMITS.question[1]}
                      onChange={(e) => setFaq(i, { question: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`Remove question ${i + 1}`}
                      onClick={() => setSeo({ faq: seo.faq.filter((_, j) => j !== i) })}
                    >
                      <Icon name="x" />
                    </button>
                  </div>
                  <textarea
                    className="textarea mt-2"
                    rows={2}
                    aria-label={`Answer ${i + 1}`}
                    value={f.answer}
                    maxLength={LIMITS.answer[1]}
                    onChange={(e) => setFaq(i, { answer: e.target.value })}
                  />
                </div>
              ))}
            </div>
            {(seo.faq || []).length < LIMITS.faq[1] && (
              <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setSeo({ faq: [...(seo.faq || []), { question: '', answer: '' }] })}>
                <Icon name="plus" />
                Add a question
              </button>
            )}
          </fieldset>
        </div>
      )}

      {(run.issues || []).length > 0 && (
        <div className="mt-4 text-[13px]">
          <p className="font-semibold text-ink">Ways to make this listing stronger</p>
          <ul className="mt-1 list-disc pl-5 text-text">
            {run.issues.map((issue: string) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
