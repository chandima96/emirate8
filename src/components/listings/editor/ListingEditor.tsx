'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { STATUS } from '@/config/reference';
import {
  brokerFromUser,
  counts,
  currentUser,
  deleteListing,
  listing as getListing,
  listingUrl,
  log,
  normalize,
  plan,
  relTime,
  saveListing,
} from '@/lib/store';
import { routes } from '@/lib/routes';
import { clone, cx } from '@/lib/utils';
import { DERIVED, NAMES, STEPS, blankListing, prepare, setIn, tokens } from './model';
import { flushWrites } from '@/lib/storage';
import { focusListingField } from './EditorSection';
import { DesignerStep } from './DesignerStep';
import { hydrateEditor, projectListing, validateEditorStep, editorReadiness } from './designer-model';
import { publicListing } from '@/lib/publicListing';
import { PreviewModal } from './PreviewModal';

function initialState(id, q) {
  const existing = id ? getListing(id) : null;
  const L = projectListing(hydrateEditor(prepare(existing ? clone(existing) : blankListing())));
  const owner = currentUser();
  if (owner?.type === 'developer' || owner?.type === 'owner') {
    L.ownerType = 'developer';
    L.ownerDeveloper = owner.id;
    if (!existing) {
      L.ownerDirect = true;
      L.claimable = true;
    } else if (L.ownerDirect === undefined) {
      L.ownerDirect = true;
      L.claimable = true;
    }
  } else if (owner?.type === 'agency') {
    L.ownerType = 'agency';
    L.ownerAgency = owner.agency?.agencyId || owner.agencyId || L.ownerAgency || '';
  }
  if (existing && existing.sample) L.authorised = true;
  const purpose = q.get('purpose');
  if (!existing && (purpose === 'sale' || purpose === 'rent')) {
    L.purpose = purpose;
    L.editor.d.purpose = purpose;
  }
  const step = Math.min(STEPS, Math.max(1, +q.get('step') || 1));
  let note = null;
  if (existing) {
    note =
      existing.status === 'sold' || existing.status === 'rented' || existing.status === 'archived'
        ? {
            warn: true,
            text:
              'This listing is ' + existing.status + '. Changes are saved to its record but it stays off the market.',
          }
        : {
            text:
              'Last saved ' + relTime(existing.updatedAt).toLowerCase() + (existing.sample ? ' · sample record' : ''),
          };
  }
  return { L, existing, step, missing: !!id && !existing, note };
}

/** The unsaved form state as the public templates expect it (old previewListing). */
function buildPreview(l) {
  const c = normalize(clone(l));
  const owner = currentUser();
  if (owner?.type === 'developer' || owner?.type === 'owner') {
    c.broker = null;
    c.brokerId = null;
  } else {
    c.broker = brokerFromUser(owner);
    c.brokerId = c.broker.id;
  }
  c.ref = c.ref || 'Assigned on save';
  c.createdAt = c.createdAt || new Date().toISOString();
  return publicListing(c);
}

/** Keeps the featured photo pointing at a photo in the list (old renderPhotos). */
function fixFeatured(l) {
  if (l.photos.length && !l.photos.some((p) => p.src === l.featured)) return { ...l, featured: l.photos[0].src };
  return l;
}

/** The 8-step listing editor for ready and off-plan listings (create: /listings/new, edit: /listings/[id]/edit). */
export function ListingEditor({ id = undefined }) {
  useStoreVersion();
  const q = useSearchParams();
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [init] = useState(() => initialState(id, q));
  const [L, setL] = useState(init.L);
  const [saved, setSaved] = useState(init.existing);
  const [step, setStep] = useState(init.step);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState(init.note || { text: 'Not saved yet' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const editRevision = useRef(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const Lref = useRef(L);
  const dirtyRef = useRef(false);
  const stepRef = useRef(step);
  const savedRef = useRef(saved);
  useEffect(() => {
    Lref.current = L;
    dirtyRef.current = dirty;
    stepRef.current = step;
    savedRef.current = saved;
  });
  const user = currentUser();
  const isDeveloper = user?.type === 'developer' || user?.type === 'owner';
  const isAgency = user?.type === 'agency';
  const verified = user.credentialStatus === 'verified';
  const [developerBrokers, setDeveloperBrokers] = useState([]);
  const [agencyBrokers, setAgencyBrokers] = useState<any[]>([]);
  useEffect(() => {
    if (!isDeveloper) return;
    fetch('/api/role-workspace?editorContext=1', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setDeveloperBrokers(Array.isArray(data?.brokers) ? data.brokers : []))
      .catch(() => setDeveloperBrokers([]));
  }, [isDeveloper]);
  useEffect(() => {
    if (!isAgency) return;
    fetch('/api/role-workspace?teamBrokers=1', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setAgencyBrokers(Array.isArray(data?.teamBrokers) ? data.teamBrokers : []))
      .catch(() => setAgencyBrokers([]));
  }, [isAgency]);

  /* not-found notice (once) */
  const warned = useRef(false);
  useEffect(() => {
    if (init.missing && !warned.current) {
      warned.current = true;
      toast('That listing could not be found in your Supabase account.', { icon: 'exclamation-circle' });
    }
  }, [init.missing, toast]);

  /* ---------- state helpers ---------- */
  const markDirty = useCallback(() => {
    editRevision.current++;
    dirtyRef.current = true;
    setDirty(true);
    setNote({ text: 'Unsaved changes' });
  }, []);
  const update = useCallback(
    (fn) => {
      setL((prev) => {
        const next = fixFeatured(projectListing(fn(prev)));
        Lref.current = next;
        return next;
      });
      markDirty();
    },
    [markDirty],
  );
  const set = (path, v) => {
    update((prev) => setIn(prev, path, v));
    setErrors({});
  };

  const setField = set;
  const t = tokens(L);
  const live = L.status === 'published';
  const publishLabel = live ? 'Update published listing' : verified ? 'Publish listing' : 'Submit for review';
  const stepLabel = { 2: 'Location', 3: 'Property details', 4: 'Price & terms' };

  /* ---------- validation ---------- */
  function focusEl(elId) {
    setTimeout(() => {
      focusListingField(elId);
    }, 40);
  }
  function check(n) {
    const bad = [...validateEditorStep(n, Lref.current, user)];
    setErrors((e) => {
      const next = { ...e };
      Object.keys(next).forEach((k) => delete next[k]);
      bad.forEach((b) => (next[b.key] = b.msg));
      return next;
    });
    if (bad[0]) focusEl(bad[0].id);
    return !bad.length;
  }

  /* ---------- navigation ---------- */
  const go = useCallback((n, focus) => {
    setStep(n);
    if (focus)
      setTimeout(() => {
        const h = document.querySelector('[data-step="' + n + '"] h2');
        (h as HTMLElement)?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 30);
  }, []);

  /* ---------- saving ---------- */
  async function persist(status = undefined) {
    if (savingRef.current) return null;
    const revision = editRevision.current;
    const obj = projectListing(clone(Lref.current));
    if (isDeveloper) {
      obj.ownerType = 'developer';
      obj.ownerDeveloper = user.id;
      obj.claimPolicy = 'developer_approval';
      if (obj.ownerDirect) {
        obj.primaryBroker = '';
        obj.claimable = obj.claimable !== false;
      } else {
        obj.claimable = false;
      }
    } else if (isAgency) {
      obj.ownerType = 'agency';
      obj.ownerAgency = user.agency?.agencyId || user.agencyId || obj.ownerAgency || '';
    }
    if (status) obj.status = status;
    else if (!savedRef.current) obj.status = 'draft';
    if (!obj.title) obj.title = '';
    const result = saveListing(obj);
    if (!result || result.error) {
      toast('The listing could not be saved. Please try again.', {
        icon: 'exclamation-circle',
        duration: 7000,
      });
      return null;
    }
    // Keep the client identity even if the server rejects this attempt; retry the same draft.
    Lref.current = { ...Lref.current, id: result.id, ref: result.ref, createdAt: result.createdAt };
    setL(Lref.current);
    savingRef.current = true;
    setSaving(true);
    setNote({ text: 'Saving...' });
    try {
      await flushWrites('data:' + user.id);
      const next = { ...(getListing(result.id) || result) };
      DERIVED.forEach((k) => delete next[k]);
      const wasNew = !savedRef.current || savedRef.current.id !== next.id;
      savedRef.current = next;
      setSaved(clone(next));
      if (editRevision.current === revision) {
        Lref.current = next;
        dirtyRef.current = false;
        setL(next);
        setDirty(false);
        setNote({ text: 'Saved just now' });
      } else {
        Lref.current = { ...Lref.current, slug: next.slug };
        setL(Lref.current);
        setNote({ text: 'Unsaved changes' });
      }
      if (wasNew && window.location.pathname !== routes.editListing(next.id)) {
        const step = stepRef.current;
        window.history.replaceState(null, '', routes.editListing(next.id, step > 1 ? step : undefined));
      }
      return next;
    } catch (error) {
      dirtyRef.current = true;
      setDirty(true);
      setNote({ text: 'Save failed. Your entries are still here. Save draft to retry.', warn: true });
      toast(error instanceof Error ? error.message : 'Could not save this property. Your entries have been kept.', {
        icon: 'exclamation-circle',
        duration: 8000,
      });
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  async function autosave() {
    if (savingRef.current) return false;
    if (dirtyRef.current || !savedRef.current) {
      const saved = await persist();
      return !!saved && !dirtyRef.current;
    }
    return true;
  }
  async function saveDraft() {
    const keep = Lref.current.status === 'pending' ? 'pending' : undefined;
    const saved = await persist(keep);
    if (!saved) return;
    toast('Draft saved.', { icon: 'floppy' });
  }

  async function discardDraft() {
    const title = savedRef.current?.title || 'this listing';
    const ok = await confirm({
      title: 'Discard this draft?',
      body: savedRef.current ? `“${title}” will be removed from your workspace.` : 'Your unsaved changes will be lost.',
      ok: 'Discard draft',
      danger: true,
    });
    if (!ok) return;
    if (savedRef.current && savedRef.current.status === 'draft') deleteListing(savedRef.current.id);
    router.push('/listings');
  }

  async function publish() {
    if (savingRef.current) return;
    for (let n = 1; n <= 8; n++) {
      if (!check(n)) {
        go(n, false);
        toast('Complete step ' + n + ' (' + NAMES[n - 1] + ') before publishing.', { icon: 'exclamation-circle' });
        setPreviewOpen(false);
        return;
      }
    }
    const cur = Lref.current;
    const r = editorReadiness(cur, currentUser());
    if (!r.complete) {
      go(STEPS, true);
      toast('Complete the checklist before publishing.', { icon: 'exclamation-circle' });
      setPreviewOpen(false);
      return;
    }
    if (!cur.authorised) {
      setPreviewOpen(false);
      go(8, false);
      setErrors((e) => ({ ...e, decl2: 'Confirm you are authorised to market this property.' }));
      focusEl('designer-decl2');
      return;
    }
    const p = plan();
    const wasLive = !!savedRef.current && savedRef.current.status === 'published';
    if (!wasLive && p.listings && counts().published >= p.listings) {
      toast(
        <>
          You’ve reached your plan’s {p.listings} published listings.{' '}
          <Link className="underline" href="/subscription">
            Compare plans
          </Link>
        </>,
        { icon: 'exclamation-circle', duration: 6000 },
      );
      return;
    }
    const to = verified ? 'published' : 'pending';
    Lref.current = setIn(cur, 'display.visible', cur.display.visible !== false);
    const s = await persist(to);
    if (!s) return;
    log(
      (to === 'published' ? (wasLive ? 'Updated' : 'Published') : 'Submitted for review') + ' “' + s.title + '”',
      to === 'published' ? 'send' : 'hourglass-split',
    );
    setPreviewOpen(false);
    toast(
      to === 'published' ? (
        <>
          {wasLive ? 'Published listing updated.' : 'Listing published.'}{' '}
          <Link className="underline" href={listingUrl(s)}>
            View public page
          </Link>
        </>
      ) : (
        'Submitted — it will publish once your credentials are verified.'
      ),
      { duration: 6000 },
    );
    setTimeout(() => router.push(routes.listing(s.id)), 900);
  }

  /* ---------- unsaved changes ---------- */
  useEffect(() => {
    const onUnload = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    // In-app navigation never fires beforeunload, so links are intercepted while there are unsaved changes.
    const onClick = (e) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      confirm({
        title: 'Leave without saving?',
        body: 'You have unsaved changes to this listing. Save a draft first to keep them.',
        ok: 'Leave',
        cancel: 'Keep editing',
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        dirtyRef.current = false;
        router.push(url.pathname + url.search + url.hash);
      });
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [confirm, router]);

  /* ---------- preview ---------- */
  const previewListing = useCallback(() => buildPreview(Lref.current), []);
  const reviewCard = useMemo(() => (step === STEPS ? buildPreview(L) : null), [step, L]);
  const ready = editorReadiness(L, user);

  const ed = {
    L,
    t,
    errors,
    set: setField,
    update,
    toast,
    confirm,
    go,
    latest: () => Lref.current,
    isDeveloper,
    user,
    developerBrokers,
    isAgency,
    agencyBrokers,
  };

  const status = STATUS[L.status] || STATUS.draft;
  const crumb = saved ? saved.title || 'Untitled listing' : 'New listing';

  const sections = NAMES.map((_, i) => (
    <DesignerStep key={i + 1} ed={ed} step={i + 1} preview={reviewCard} ready={ready} />
  ));

  return (
    <div className="listing-editor mx-auto max-w-[1320px] px-4 pb-16 sm:px-6 lg:px-12">
      <nav className="mb-3 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/listings" className="hover:text-ink">
          My Listings
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{crumb}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">Listings</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="listing-editor-title">{saved ? 'Edit property' : 'Create a listing'}</h1>
            <span className={'badge ' + status.cls}>{status.label}</span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {note.warn ? <span className="text-warn">{note.text}</span> : note.text}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-danger" onClick={discardDraft}>
            <Icon name="trash3" /> Discard draft
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setPreviewOpen(true)}>
            <Icon name="eye" />
            Preview Listing
          </button>
          <button type="button" className="btn btn-outline" disabled={saving} onClick={saveDraft}>
            <Icon name="floppy" />
            Save draft
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)]">
        <ol
          className="no-scrollbar flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:gap-0.5 lg:self-start"
          aria-label="Listing steps"
        >
          {NAMES.map((name, i) => {
            const k = i + 1;
            return (
              <li key={k}>
                <button
                  type="button"
                  className={cx(
                    'wz-step flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] whitespace-nowrap',
                    k === step && 'is-current',
                    k !== step && validateEditorStep(k, L, user).length === 0 && 'is-done',
                  )}
                  aria-current={k === step ? 'step' : undefined}
                  disabled={saving}
                  onClick={async () => {
                    if (k > step && !check(step)) return;
                    if (k > step && !(await autosave())) return;
                    go(k, true);
                  }}
                >
                  <span className="step-dot">{k}</span>
                  {stepLabel[k] ||
                    {
                      1: 'Classification',
                      5: 'Marketing',
                      6: 'Photos & media',
                      7: 'Permit & display',
                      8: 'Review & publish',
                    }[k]}
                </button>
              </li>
            );
          })}
        </ol>

        <form
          className="listing-editor-panel card min-w-0 p-5 sm:p-7 lg:p-8"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (savingRef.current) return;
            if (step < STEPS && check(step)) {
              if (!(await autosave())) return;
              go(step + 1, true);
            }
          }}
        >
          {Object.keys(errors).length > 0 && (
            <div className="mb-5 rounded-lg border border-danger/30 bg-danger-soft p-4" role="alert">
              <p className="text-sm font-semibold text-danger">Please check these fields</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-danger">
                {Object.entries(errors).map(([key, message]) => (
                  <li key={key}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          {sections.map((s, i) => (
            <section key={i} data-step={i + 1} hidden={step !== i + 1}>
              {s}
            </section>
          ))}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {step > 1 && (
              <button type="button" className="btn btn-ghost" onClick={() => go(step - 1, true)}>
                <Icon name="arrow-left" />
                Back
              </button>
            )}
            <span className="text-xs text-muted">
              Step {step} of {STEPS} · {NAMES[step - 1]}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {step === STEPS ? (
                <>
                  <button type="button" className="btn btn-outline" onClick={() => setPreviewOpen(true)}>
                    <Icon name="eye" />
                    Preview Listing
                  </button>
                  <button type="button" className="btn btn-dark" disabled={saving} onClick={publish}>
                    <Icon name="send" />
                    {publishLabel}
                  </button>
                </>
              ) : (
                <button type="submit" className="btn btn-dark" disabled={saving}>
                  {saving ? 'Saving...' : 'Continue'}
                  <Icon name="arrow-right" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        getListing={previewListing}
        complete={ready.complete}
        publishLabel={publishLabel}
        onSave={saveDraft}
        onPublish={publish}
      />
    </div>
  );
}
