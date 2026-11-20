'use client';

import { useState } from 'react';
import type { Appearance, Stripe as StripeJs } from '@stripe/stripe-js';
import { CheckoutElementsProvider, PaymentElement, useCheckout } from '@stripe/react-stripe-js/checkout';
import { cx } from '@/lib/utils';

/*
 * Payment step built from Stripe Elements on a Checkout Session (`ui_mode: 'elements'`), so the form uses the
 * site's own layout, type and controls instead of Stripe's iframe page. Stripe still owns the session, the
 * subscription and the webhook; card data stays inside Stripe's secure fields.
 */

/** Mirrors the design tokens in globals.css (ink, line, muted, danger, 4px radius, Instrument Sans). */
const APPEARANCE: Appearance = {
  theme: 'stripe',
  labels: 'above',
  variables: {
    colorPrimary: '#142326',
    colorBackground: '#ffffff',
    colorText: '#172326',
    colorTextSecondary: '#6a7472',
    colorTextPlaceholder: '#9aa3a1',
    colorDanger: '#a23b32',
    colorSuccess: '#2f6b4a',
    fontFamily: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: '14px',
    fontWeightNormal: '400',
    fontWeightMedium: '600',
    borderRadius: '4px',
    spacingUnit: '4px',
    gridRowSpacing: '16px',
    gridColumnSpacing: '12px',
    focusBoxShadow: '0 0 0 3px rgba(169, 192, 175, 0.35)',
    focusOutline: 'none',
  },
  rules: {
    '.Label': { fontSize: '12px', fontWeight: '600', color: '#142326', marginBottom: '6px' },
    '.Input': {
      border: '1px solid #dce2de',
      boxShadow: 'none',
      padding: '11px 12px',
      transition: 'border-color .2s, box-shadow .2s',
    },
    '.Input:hover': { borderColor: '#c3ccc7' },
    '.Input:focus': { borderColor: '#142326', boxShadow: '0 0 0 3px rgba(169, 192, 175, 0.35)' },
    '.Input--invalid': { borderColor: '#a23b32', boxShadow: 'none' },
    '.Error': { fontSize: '12px', marginTop: '6px' },
    '.Tab': { border: '1px solid #dce2de', boxShadow: 'none', padding: '12px' },
    '.Tab:hover': { borderColor: '#b8c3be' },
    '.Tab--selected, .Tab--selected:hover, .Tab--selected:focus': {
      borderColor: '#142326',
      boxShadow: 'inset 0 0 0 1px #142326',
    },
    '.TabLabel': { fontWeight: '600' },
    '.Block': { border: '1px solid #dce2de', boxShadow: 'none' },
  },
};

const FONTS = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap' }];

type Props = {
  stripe: Promise<StripeJs | null> | null;
  clientSecret: string;
  onComplete: () => void;
  onBack: () => void;
};

export function StripePayment({ stripe, clientSecret, onComplete, onBack }: Props) {
  return (
    <CheckoutElementsProvider
      key={clientSecret}
      stripe={stripe}
      options={{ clientSecret, elementsOptions: { appearance: APPEARANCE, fonts: FONTS, loader: 'never' } }}
    >
      <PaymentForm onComplete={onComplete} onBack={onBack} />
    </CheckoutElementsProvider>
  );
}

function PaymentForm({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const state = useCheckout();
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (state.type === 'error') {
    return (
      <div className="mt-6 space-y-5">
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[13px] leading-5 text-danger" role="alert">
          {state.error.message || 'We could not load the payment form. Please try again.'}
        </p>
        <BackButton onBack={onBack} />
      </div>
    );
  }

  const checkout = state.type === 'success' ? state.checkout : null;
  const item = checkout?.lineItems[0];
  const total = checkout?.total.total.amount;
  const interval = checkout?.recurring?.interval || 'month';

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkout || busy) return;
    setBusy(true);
    setError('');
    const res = await checkout.confirm({ redirect: 'if_required' });
    if (res.type === 'error') {
      setError(res.error.message || 'Your payment could not be completed. Please check your details and try again.');
      setBusy(false);
      return;
    }
    onComplete();
  };

  return (
    <form className="mt-6" onSubmit={pay} noValidate aria-busy={busy}>
      {/* Order summary */}
      <div className="auth-rise rounded-lg border border-line bg-white" style={{ '--d': 1 } as React.CSSProperties}>
        <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Membership</p>
            {item ? (
              <p className="mt-1 font-display text-[16px] font-semibold text-ink">{item.name}</p>
            ) : (
              <span className="mt-1.5 block h-5 w-44 animate-pulse rounded bg-mist" />
            )}
            <p className="mt-1 text-[13px] text-muted">Billed every {interval} · cancel any time</p>
          </div>
          <div className="shrink-0 text-right">
            {total ? (
              <p className="font-display text-[22px] leading-none font-semibold text-ink tabular-nums">{total}</p>
            ) : (
              <span className="block h-6 w-24 animate-pulse rounded bg-mist" />
            )}
            <p className="mt-1 text-xs text-muted">per {interval}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line bg-paper/60 px-4 py-2.5 text-[13px] sm:px-5">
          <span className="text-muted">Due today</span>
          <span className="font-semibold text-ink tabular-nums">{total || '—'}</span>
        </div>
      </div>

      {/* Payment details */}
      <fieldset className="auth-rise mt-6" style={{ '--d': 2 } as React.CSSProperties}>
        <legend className="label">Payment details</legend>
        <div className="relative min-h-[220px]">
          {!ready && <FieldsSkeleton />}
          <div className={cx('transition-opacity duration-300', ready ? 'opacity-100' : 'pointer-events-none absolute inset-x-0 top-0 opacity-0')}>
            {checkout && (
              <PaymentElement
                options={{ layout: { type: 'tabs' } }}
                onReady={() => setReady(true)}
                onChange={(ev) => {
                  setComplete(ev.complete);
                  if (error) setError('');
                }}
              />
            )}
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="auth-reveal mt-5 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[13px] leading-5 text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="auth-press btn btn-dark btn-lg mt-6 w-full"
        disabled={!checkout || !ready || !complete || busy}
        aria-busy={busy}
      >
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Processing payment
          </>
        ) : (
          <>
            <i className="bi bi-lock" aria-hidden="true" />
            {total ? `Pay ${total} and subscribe` : 'Pay and subscribe'}
          </>
        )}
      </button>

      <p className="mt-3 text-center text-xs leading-[1.6] text-muted">
        By subscribing you authorise Emirate08 to charge this payment method {total ? `${total} ` : ''}every {interval}{' '}
        until you cancel.
      </p>

      <div className="mt-6 border-t border-line pt-5">
        <BackButton onBack={onBack} disabled={busy} />
      </div>
    </form>
  );
}

function BackButton({ onBack, disabled = false }: { onBack: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="auth-press btn btn-ghost" onClick={onBack} disabled={disabled}>
      <i className="bi bi-arrow-left" aria-hidden="true" />
      Change plan
    </button>
  );
}

/** Placeholder in the shape of the card fields while Stripe's iframe loads. */
function FieldsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[58px] animate-pulse rounded border border-line bg-white" />
        ))}
      </div>
      <span className="block h-3 w-24 animate-pulse rounded bg-mist" />
      <span className="block h-11 animate-pulse rounded border border-line bg-white" />
      <div className="grid grid-cols-2 gap-3">
        <span className="h-11 animate-pulse rounded border border-line bg-white" />
        <span className="h-11 animate-pulse rounded border border-line bg-white" />
      </div>
    </div>
  );
}
