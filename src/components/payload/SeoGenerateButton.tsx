'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, useDocumentInfo, useFormFields } from '@payloadcms/ui';

/**
 * "Generate SEO" in Payload admin (Properties, Brokers and SEO content records). Runs the SEO content
 * agent for this record's public page, platform-paid, and stores the result in SEO content. Shown as a
 * `ui` field, so it saves nothing on the record itself.
 */
export function SeoGenerateButton() {
  const { collectionSlug, id } = useDocumentInfo();
  const slug = useFormFields(([fields]) => fields?.slug?.value as string | undefined);
  const storedPath = useFormFields(([fields]) => fields?.path?.value as string | undefined);
  const [state, setState] = useState<{ busy: boolean; message: string; ok?: boolean }>({ busy: false, message: '' });

  const path =
    collectionSlug === 'seo-content'
      ? storedPath || ''
      : slug
        ? (collectionSlug === 'brokers' ? '/brokers/' : '/property/') + encodeURIComponent(slug)
        : '';

  const run = async () => {
    setState({ busy: true, message: 'Writing SEO content… this takes up to a minute.' });
    try {
      const response = await fetch('/api/seo-agent/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(out.error || `Request failed (${response.status}).`);
      const done = out.processed?.[0];
      if (!done) throw new Error(out.stoppedEarly || 'Nothing was written.');
      if (done.status === 'failed') throw new Error(done.error || 'The agent could not write valid content.');
      setState({
        busy: false,
        ok: true,
        message:
          done.status === 'approved'
            ? 'Done: the new content is approved and live on the page.'
            : 'Done: a draft is waiting in SEO content. Set it to Approved to publish it.',
      });
    } catch (error) {
      setState({ busy: false, ok: false, message: error instanceof Error ? error.message : 'Could not generate SEO.' });
    }
  };

  if (!id) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <Button buttonStyle="secondary" size="small" disabled={state.busy || !path} onClick={run}>
        {state.busy ? 'Generating SEO…' : 'Generate SEO'}
      </Button>
      <p style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
        {path
          ? `Writes the SEO title, meta description and FAQ for ${path} from its public facts (platform-paid).`
          : 'Save the record with a slug first.'}
      </p>
      {state.message && (
        <p role="status" style={{ marginTop: 6, fontSize: 13, color: state.ok === false ? 'var(--theme-error-500)' : undefined }}>
          {state.message}
          {state.ok && collectionSlug !== 'seo-content' && (
            <>
              {' '}
              <Link href="/admin/collections/seo-content">Open SEO content</Link>
            </>
          )}
          {state.ok && collectionSlug === 'seo-content' && ' Reload the page to see it.'}
        </p>
      )}
    </div>
  );
}
