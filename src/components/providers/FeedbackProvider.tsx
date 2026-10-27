'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/utils';
import type { ReactNode } from 'react';

type ToastOptions = { icon?: string; duration?: number };
type ConfirmOptions = { title: string; body?: ReactNode; ok?: string; cancel?: string; danger?: boolean };
const FeedbackContext = createContext<{
  toast: (message: ReactNode, options?: ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}>({ toast: () => {}, confirm: () => Promise.resolve(false) });

/** Toast notifications and a promise-based confirm dialog, available everywhere via useFeedback(). */
export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const toast = useCallback((message: ReactNode, opts: ToastOptions = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, message, icon: opts.icon || 'check-lg' }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), opts.duration || 3600);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setDialog(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    setDialog(null);
    resolver.current?.(result);
    resolver.current = null;
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast toast-in" role="status">
            <Icon name={t.icon} className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
            <div className="flex-1">{t.message}</div>
          </div>
        ))}
      </div>
      <Modal open={!!dialog} onClose={() => close(false)} role="alertdialog" labelledBy="cf-title" panelClassName="p-6">
        {dialog && (
          <>
            <h2 id="cf-title" className="h4">
              {dialog.title}
            </h2>
            <div className="mt-2 text-[13px] leading-[1.6] text-muted">{dialog.body}</div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => close(false)}>
                {dialog.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                className={cx('btn', dialog.danger ? 'btn-danger' : 'btn-dark')}
                onClick={() => close(true)}
                data-ok
              >
                {dialog.ok || 'Confirm'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}
