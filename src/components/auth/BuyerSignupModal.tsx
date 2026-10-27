'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { QuickBuyerForm } from './QuickBuyerForm';

export function BuyerSignupModal({ className = '', open: controlledOpen = undefined, onOpenChange = undefined }) {
  const router = useRouter();
  const [localOpen, setLocalOpen] = useState(false);
  const [view, setView] = useState<'options' | 'email'>('options');
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : localOpen;

  const setOpen = (next) => {
    if (!controlled) setLocalOpen(next);
    onOpenChange?.(next);
  };

  const close = () => {
    setOpen(false);
    setView('options');
  };

  const openModal = () => {
    setView('options');
    setOpen(true);
  };

  return (
    <>
      {!controlled && <button type="button" className={`btn btn-light ${className}`} onClick={openModal}>Create a free buyer account</button>}
      <Modal
        open={open}
        onClose={close}
        labelledBy="buyer-signup-title"
        panelClassName="w-[min(100%-2rem,480px)] max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:p-8"
      >
        {view === 'options' ? (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Buyer account</p>
                <h2 id="buyer-signup-title" className="h3 mt-2">Save your favourite homes.</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Create a free account to save properties, contact brokers and follow developer updates.</p>
              </div>
              <button type="button" className="btn btn-outline h-10 w-10 shrink-0 px-0" onClick={close} aria-label="Close sign-up dialog">×</button>
            </div>
            <div className="mt-7 space-y-3">
              <form action="/api/auth/google" method="get">
                <input type="hidden" name="next" value="/saved" />
                <button type="submit" className="btn btn-dark w-full">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-ink" aria-hidden="true">G</span>
                  Continue with Google
                </button>
              </form>
              <div className="flex items-center gap-3 py-1 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
              <button type="button" className="btn btn-outline w-full" onClick={() => setView('email')}>Continue with email</button>
            </div>
            <p className="mt-6 text-center text-sm text-muted">Already registered? <button type="button" className="link" onClick={() => { close(); router.push('/login'); }}>Sign in</button></p>
            <p className="mt-5 border-t border-line pt-4 text-center text-xs leading-5 text-muted">Are you a broker, agency or developer? <Link className="link" href="/register">Create a professional account</Link></p>
          </div>
        ) : (
          <Suspense fallback={<div className="min-h-[360px]" />}>
            <QuickBuyerForm embedded onCancel={() => setView('options')} onSuccess={(destination) => { close(); router.push(destination); }} />
          </Suspense>
        )}
      </Modal>
    </>
  );
}
