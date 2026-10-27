'use client';

import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';

export function AuthChoiceModal({ open, onClose, onBuyer, onProfessional }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="auth-choice-title"
      panelClassName="w-[min(100%-2rem,480px)] overflow-hidden rounded-2xl bg-paper p-0 shadow-[0_24px_80px_rgba(12,27,29,0.28)]"
    >
      <div className="relative overflow-hidden bg-ink-deep px-6 py-6 text-white sm:px-7">
        <div className="pointer-events-none absolute -right-8 -top-16 h-40 w-40 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-2 -top-10 h-28 w-28 rounded-full border border-sage/15" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[.2em] text-sage uppercase">Emirate08</p>
            <h2 id="auth-choice-title" className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">Choose your path</h2>
            <p className="mt-1 text-sm text-white/65">Select your account type to continue.</p>
          </div>
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close">
            <Icon name="x-lg" className="text-sm" />
          </button>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        <button
          type="button"
          className="group relative flex min-h-36 flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-line bg-white p-5 text-center shadow-[0_2px_8px_rgba(20,35,38,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_12px_28px_rgba(20,35,38,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={onProfessional}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-deep text-white shadow-inner transition-transform duration-200 group-hover:scale-105">
            <Icon name="person-vcard" className="text-4xl" />
          </span>
          <span className="font-display text-base font-semibold text-ink">Professional</span>
          <span className="absolute right-3 top-3 text-muted/50 transition-all group-hover:translate-x-0.5 group-hover:text-ink"><Icon name="arrow-up-right" className="text-sm" /></span>
        </button>
        <button
          type="button"
          className="group relative flex min-h-36 flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-line bg-white p-5 text-center shadow-[0_2px_8px_rgba(20,35,38,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sage-deep/40 hover:shadow-[0_12px_28px_rgba(20,35,38,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={onBuyer}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage/25 text-sage-deep shadow-inner transition-transform duration-200 group-hover:scale-105">
            <Icon name="house-heart" className="text-4xl" />
          </span>
          <span className="font-display text-base font-semibold text-ink">Buyer</span>
          <span className="absolute right-3 top-3 text-muted/50 transition-all group-hover:translate-x-0.5 group-hover:text-sage-deep"><Icon name="arrow-up-right" className="text-sm" /></span>
        </button>
      </div>
    </Modal>
  );
}
