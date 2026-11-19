'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/utils';
import { QuickBuyerForm } from './QuickBuyerForm';

type Audience = 'buyer' | 'professional';

const PRO_POINTS = [
  { icon: 'person-vcard', text: 'A public portfolio for brokers, agencies and developers' },
  { icon: 'house-add', text: 'List properties and manage enquiries in one workspace' },
  { icon: 'patch-check', text: 'Verified credentials shown on every listing' },
];

/**
 * Sign-up from the login page. Buyers (the default) register right here with Google or email;
 * switching to Professional leads on to the full professional registration.
 */
export function RegisterChoiceModal({ open, onClose, next = '' }: { open: boolean; onClose: () => void; next?: string }) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>('buyer');
  const [view, setView] = useState<'options' | 'email'>('options');
  // Which way the panel slides in: towards the side the user moved to.
  const [dir, setDir] = useState<1 | -1>(1);

  const close = () => {
    onClose();
    setAudience('buyer');
    setView('options');
  };
  const choose = (target: Audience) => {
    if (target === audience) return;
    setDir(target === 'professional' ? 1 : -1);
    setAudience(target);
    setView('options');
  };
  const showEmail = (show: boolean) => {
    setDir(show ? 1 : -1);
    setView(show ? 'email' : 'options');
  };
  const pro = audience === 'professional';

  return (
    <Modal
      open={open}
      onClose={close}
      labelledBy="register-choice-title"
      panelClassName="w-[min(100%-2rem,480px)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-paper p-0 shadow-[0_24px_80px_rgba(12,27,29,0.28)]"
    >
      <div className="relative overflow-hidden bg-ink-deep px-6 pt-6 pb-5 text-white sm:px-7">
        <div className="pointer-events-none absolute -top-16 -right-8 h-40 w-40 rounded-full border border-white/10 transition-transform duration-700 ease-out" style={{ transform: pro ? 'translateX(-24px) scale(1.08)' : 'none' }} />
        <div className="pointer-events-none absolute -top-10 -right-2 h-28 w-28 rounded-full border border-sage/15 transition-transform duration-700 ease-out" style={{ transform: pro ? 'translateX(-40px)' : 'none' }} />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[.2em] text-sage uppercase">Emirate08</p>
            <h2 id="register-choice-title" className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
              Create your account
            </h2>
            <p className="mt-1 text-sm text-white/65">Free to join. Choose how you’ll use Emirate08.</p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:bg-white/10 hover:text-white"
            onClick={close}
            aria-label="Close"
          >
            <Icon name="x-lg" className="text-sm" />
          </button>
        </div>

        <div role="radiogroup" aria-label="Account type" className="relative mt-5 grid grid-cols-2 rounded-full border border-white/15 bg-white/5 p-1">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none"
            style={{ transform: pro ? 'translateX(100%)' : 'none' }}
          />
          {([
            ['buyer', 'house-heart', 'Buyer'],
            ['professional', 'briefcase', 'Professional'],
          ] as const).map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={audience === value}
              className={cx(
                'relative z-10 flex h-9 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage',
                audience === value ? 'text-ink' : 'text-white/70 hover:text-white',
              )}
              onClick={() => choose(value)}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                  e.preventDefault();
                  choose(pro ? 'buyer' : 'professional');
                }
              }}
            >
              <Icon name={icon} className="text-[15px]" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden">
        <div key={`${audience}-${view}`} className="reg-pane p-6 sm:p-7" style={{ '--reg-dir': dir } as React.CSSProperties}>
          {pro ? (
            <div>
              <p className="eyebrow">Professional account</p>
              <h3 className="h3 mt-2">For brokers, agencies and developers.</h3>
              <ul className="mt-5 space-y-3">
                {PRO_POINTS.map((point, n) => (
                  <li key={point.icon} className="reg-item flex items-start gap-3 text-sm leading-6 text-ink" style={{ animationDelay: `${80 + n * 60}ms` }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-deep text-white">
                      <Icon name={point.icon} className="text-[15px]" />
                    </span>
                    <span className="pt-1">{point.text}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-dark btn-lg group mt-7 w-full" onClick={() => { close(); router.push('/register'); }}>
                Continue to professional registration
                <Icon name="arrow-right" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
              <p className="mt-4 text-center text-xs leading-5 text-muted">
                Looking for a home instead?{' '}
                <button type="button" className="link" onClick={() => choose('buyer')}>
                  Switch to buyer
                </button>
              </p>
            </div>
          ) : view === 'options' ? (
            <div>
              <p className="eyebrow">Buyer account</p>
              <h3 className="h3 mt-2">Save your favourite homes.</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Save properties, contact brokers and follow developer updates.</p>
              <div className="mt-6 space-y-3">
                <form action="/api/auth/google" method="get" className="reg-item" style={{ animationDelay: '80ms' }}>
                  <input type="hidden" name="next" value={next || '/saved'} />
                  <button type="submit" className="btn btn-dark btn-lg w-full">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-ink" aria-hidden="true">G</span>
                    Continue with Google
                  </button>
                </form>
                <div className="reg-item flex items-center gap-3 py-1 text-2xs tracking-[.12em] text-muted uppercase" style={{ animationDelay: '130ms' }}>
                  <span className="h-px flex-1 bg-line" />
                  or
                  <span className="h-px flex-1 bg-line" />
                </div>
                <button type="button" className="reg-item btn btn-outline btn-lg w-full" style={{ animationDelay: '180ms' }} onClick={() => showEmail(true)}>
                  <Icon name="envelope" className="h-4 w-4" />
                  Continue with email
                </button>
              </div>
            </div>
          ) : (
            <Suspense fallback={<div className="min-h-[360px]" />}>
              <QuickBuyerForm
                embedded
                onCancel={() => showEmail(false)}
                onSignIn={close}
                onSuccess={(destination) => {
                  close();
                  router.push(destination);
                }}
              />
            </Suspense>
          )}
        </div>
      </div>
    </Modal>
  );
}
