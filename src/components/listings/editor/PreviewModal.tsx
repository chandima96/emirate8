'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';

/**
 * Two-tab preview (property card / full property page, desktop / mobile). The iframe renders the real public
 * templates at /preview/listing and receives the unsaved listing by postMessage:
 *   iframe → parent  { type: 'e08-preview-ready' }
 *   parent → iframe  { type: 'e08-preview', mode, viewport, listing }  (on ready, on load and on every tab/viewport change)
 */
export function PreviewModal({ open, onClose, getListing, complete, publishLabel, onSave, onPublish }) {
  const [tab, setTab] = useState('card');
  const [vp, setVp] = useState('desktop');
  const frame = useRef(null);
  const state = useRef({ tab, vp });
  useEffect(() => {
    state.current = { tab, vp };
  });

  const post = useCallback(() => {
    const win = frame.current && frame.current.contentWindow;
    if (!win) return;
    try {
      const { tab: mode, vp: viewport } = state.current;
      win.postMessage(JSON.parse(JSON.stringify({ type: 'e08-preview', mode, viewport, listing: getListing() })), '*');
    } catch {
      /* frame not ready */
    }
  }, [getListing]);

  useEffect(() => {
    if (!open) return undefined;
    const onMsg = (e) => {
      if (frame.current && e.source === frame.current.contentWindow && e.data && e.data.type === 'e08-preview-ready')
        post();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [open, post]);

  // Re-post on every tab / viewport change (and when the modal opens).
  useEffect(() => {
    if (open) post();
  }, [open, tab, vp, post]);

  const src = '/preview/listing?mode=' + (tab === 'card' ? 'card' : 'page');

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="pv-title"
      panelClassName="modal-xl flex h-[94vh] flex-col overflow-hidden sm:h-[92vh]"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 id="pv-title" className="h4 mr-1">
          Preview
        </h2>
        <span className="badge badge-warn">
          <Icon name="eye" className="h-3 w-3" />
          Preview mode — not visible to buyers
        </span>
        <div className="flex border-b border-transparent" role="tablist" aria-label="Preview type">
          {[
            ['card', 'pvt-card', 'Property card'],
            ['page', 'pvt-page', 'Full property page'],
          ].map(([key, id, label]) => (
            <button
              key={key}
              type="button"
              className="tab"
              role="tab"
              id={id}
              aria-selected={tab === key}
              aria-controls="pv-body"
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="seg ml-auto" role="group" aria-label="Viewport">
          {[
            ['desktop', 'display', 'Desktop'],
            ['mobile', 'phone', 'Mobile'],
          ].map(([key, icon, label]) => (
            <button key={key} type="button" aria-pressed={vp === key} onClick={() => setVp(key)} aria-label={label}>
              <Icon name={icon} className="h-3.5 w-3.5" />
              <span className="ml-1 hidden sm:inline" aria-hidden="true">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div
        id="pv-body"
        className="min-h-0 flex-1 overflow-hidden bg-mist p-2 sm:p-4"
        role="tabpanel"
        aria-labelledby={tab === 'card' ? 'pvt-card' : 'pvt-page'}
      >
        <div className="pv-frame h-full" data-vp={vp}>
          <iframe
            ref={frame}
            title="Listing preview"
            className="block h-full w-full bg-paper"
            src={src}
            onLoad={post}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-5">
        <p className="text-xs text-muted">
          {tab === 'card'
            ? 'The same card component is used in search results, the homepage and your portfolio.'
            : 'The full page uses the same template buyers see. Links and contact buttons are disabled in preview.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <Icon name="arrow-left" />
            Back to editing
          </button>
          <button type="button" className="btn btn-outline" onClick={onSave}>
            <Icon name="floppy" />
            Save draft
          </button>
          <button
            type="button"
            className="btn btn-dark"
            disabled={!complete}
            title={complete ? undefined : 'Complete the checklist to publish'}
            onClick={onPublish}
          >
            <Icon name="send" />
            {publishLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
