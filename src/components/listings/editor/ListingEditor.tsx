'use client';

import { coordinatesFromMapLink } from './DesignerWidgets';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { AiField as Field, AiNotice, AiReviewContext, AiStatus, type AiFieldState, type AiSuggestion } from '@/components/ui/AiAssist';
import { AiAutofill, type AiFoundPhotos } from '@/components/profiles/AiAutofill';
import type { AiPhoto } from './AiPhotoSuggestions';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { useStoreVersion } from '@/hooks/useStore';
import { STATUS } from '@/config/reference';
import {
  brokerFromUser,
  counts,
  currentUser,
  deleteListing,
  listing as getListing,
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
import { listingSchema as S } from './designer-schema';
import { DesignerStep } from './DesignerStep';
import { hydrateEditor, projectListing, validateEditorStep, editorReadiness } from './designer-model';
import { publicListing } from '@/lib/publicListing';
import { PreviewModal } from './PreviewModal';
import { STEP_HINTS, STEP_TIPS } from './stepGuide';
import { LISTING_AI_PRIVATE_FIELDS } from '@/lib/listingAutofill';
import { readAiResponse } from '@/components/ai/AiCredits';

/** Account listing defaults (Account › Listing defaults) copied into a new draft. */
function withPresets(l, owner) {
  const presets = owner?.prefs?.listing;
  if (!presets) return l;
  const contact = presets.contact || {};
  const hasContact = !!(contact.phone || contact.whatsapp || contact.email);
  const d = { ...l.editor.d, areaUnit: presets.areaUnit === 'sqm' ? 'sqm' : 'sqft' };
  const sources = { ...(l.editor.sources || {}) };
  if (hasContact) {
    Object.assign(d, {
      overrideContact: true,
      cPhone: contact.phone || '',
      cWhats: contact.whatsapp || '',
      cEmail: contact.email || '',
      cHours: contact.hours || '',
      cChannels: ['phone', 'whatsapp', 'email'].filter((k) => !!contact[k === 'whatsapp' ? 'whatsapp' : k]),
    });
    ['overrideContact', 'cPhone', 'cWhats', 'cEmail', 'cHours', 'cChannels'].forEach((k) => (sources[k] = 'defaults'));
  }
  return { ...l, editor: { ...l.editor, d, presets, sources } };
}

function initialState(id, q) {
  const existing = id ? getListing(id) : null;
  const owner = currentUser();
  const base = hydrateEditor(prepare(existing ? clone(existing) : blankListing()));
  const L = projectListing(existing ? base : withPresets(base, owner));
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
    if (!existing) {
      L.ownerType = 'agency';
      L.ownerAgency = owner.agency?.agencyId || owner.agencyId || L.ownerAgency || '';
    }
  }
  if (existing && existing.sample) L.authorised = true;
  const purpose = q.get('purpose');
  if (!existing && (purpose === 'sale' || purpose === 'rent')) {
    L.purpose = purpose;
    L.editor.d.purpose = purpose;
  }
  const stepCount = owner?.type === 'agency' ? STEPS + 1 : STEPS;
  const step = Math.min(stepCount, Math.max(1, +q.get('step') || 1));
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

/** Listing editor with an agency-only team assignment step before review. */
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
  const aiFirstStep = useRef(1);
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
  const totalSteps = STEPS + (isAgency ? 1 : 0);
  const reviewStep = totalSteps;
  const stepNames = isAgency ? [...NAMES.slice(0, 7), 'Team member', NAMES[7]] : NAMES;
  const schemaStep = (uiStep: number) => (isAgency && uiStep === reviewStep ? STEPS : uiStep);
  const stepErrors = (uiStep: number) => isAgency && uiStep === 8 ? [] : validateEditorStep(schemaStep(uiStep), L, user);
  const verified = user.credentialStatus === 'verified';
  const [developerBrokers, setDeveloperBrokers] = useState([]);
  const [agencyBrokers, setAgencyBrokers] = useState<any[]>([]);
  // Photos AI listing found (attached image files, photos on linked pages). They stay here, outside the
  // draft, until the user picks which to add in Photos & media.
  const [aiPhotos, setAiPhotos] = useState<AiPhoto[]>([]);
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
  };

  const setField = set;

  /* ---------- AI review state ---------- */
  // Kept in the draft (editor.ai) so AI-filled badges and pending suggestions survive a refresh.
  type AiChange = { before: any; applied: any };
  const aiState = L.editor?.ai || {};
  const aiChanges: Record<string, AiChange> = aiState.changes || {};
  const aiAmenChanges: Record<string, AiChange> = aiState.amen || {};
  const aiPlanChange: AiChange | null = aiState.plan || null;
  const aiSuggestions: Record<string, AiSuggestion> = aiState.suggestions || {};
  // Which wizard step each AI-fillable answer lives on.
  const stepFor: Record<string, number> = { purpose: 1, category: 1, ptype: 1, devStatus: 1, stage: 1, txn: 1, emirate: 2, communityId: 2, subcommunity: 2, mapLocation: 2, buildingName: 2, developer: 2, street: 2, bedrooms: 3, bathrooms: 3, parking: 3, unitArea: 3, builtUpArea: 3, plotArea: 3, floorBand: 3, amenities: 3, furnishing: 3, condition: 3, occupancy: 3, completionYear: 3, handoverQ: 3, handoverY: 3, tenure: 3, askingPrice: 4, possession: 4, unitPrice: 4, annualRent: 4, serviceCharge: 4, serviceBasis: 4, title: 5, description: 5, locHighlights: 5 };
  const stepOf = (key: string) => stepFor[key] || (S.STEP_OF[key.replace(/(Max|Multi)$/, '')] ?? 0) + 1;
  const patchAi = (field: 'changes' | 'amen' | 'plan' | 'suggestions', next: any) =>
    update((prev) => {
      const current = prev.editor?.ai || {};
      const value = typeof next === 'function' ? next(current[field] || (field === 'plan' ? null : {})) : next;
      return setIn(prev, 'editor.ai', { ...current, [field]: value });
    });
  const setAiChanges = (next: Record<string, AiChange>) => patchAi('changes', next);
  const setAiAmenChanges = (next: Record<string, AiChange>) => patchAi('amen', next);
  const setAiPlanChange = (next: AiChange | null) => patchAi('plan', next);
  const setAiSuggestions = (next: Record<string, AiSuggestion> | ((current: Record<string, AiSuggestion>) => Record<string, AiSuggestion>)) =>
    patchAi('suggestions', next);

  /* ---------- SEO assistant ---------- */
  // Runs right after autofill and from "Generate SEO" (Marketing › Title & description). It saves the
  // listing's `seo` block (SEO title, meta description, FAQ) and offers a rewritten listing title and
  // description: an empty field is filled (undo-able with the autofill changes), text the broker already
  // has waits as a suggestion in its field. Charged to the member's AI credits.
  const [seoBusy, setSeoBusy] = useState(false);
  const [seoError, setSeoError] = useState('');
  const [seoIssues, setSeoIssues] = useState<string[]>([]);
  const seoQueued = useRef(false);
  const seoRunning = useRef(false);
  const runSeo = async () => {
    if (seoRunning.current) return;
    seoRunning.current = true;
    setSeoBusy(true);
    setSeoError('');
    try {
      const response = await fetch('/api/listing-seo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ listing: projectListing(clone(Lref.current)) }),
      });
      const out = await readAiResponse(response);
      if (!response.ok) throw new Error(out.error || 'SEO could not be written.');
      const current = Lref.current.editor.d;
      const fills: Record<string, string> = {};
      const pending: Record<string, AiSuggestion> = {};
      for (const [key, value] of [['title', out.listingTitle], ['description', out.listingDescription]] as const) {
        if (typeof value !== 'string' || !value.trim() || value === current[key]) continue;
        if (current[key] == null || String(current[key]).trim() === '') fills[key] = value;
        else pending['designer-' + key] = { value, sources: ['SEO assistant'], options: [] };
      }
      update((prev) => {
        let next = setIn(prev, 'seo', out.seo);
        if (Object.keys(fills).length) next = setIn(next, 'editor.d', { ...next.editor.d, ...fills });
        const ai = next.editor?.ai || {};
        const changes = { ...(ai.changes || {}) };
        for (const [k, v] of Object.entries(fills)) changes[k] = { before: changes[k]?.before ?? prev.editor.d[k], applied: v };
        return setIn(next, 'editor.ai', { ...ai, changes, suggestions: { ...(ai.suggestions || {}), ...pending } });
      });
      setSeoIssues(Array.isArray(out.issues) ? out.issues : []);
      toast(
        Object.keys(pending).length
          ? 'SEO is ready. A new title and description are waiting for your review in Marketing.'
          : 'SEO title, meta description and FAQ are ready in Marketing.',
        { duration: 6000 },
      );
    } catch (error) {
      setSeoError(error instanceof Error ? error.message : 'SEO could not be written.');
    } finally {
      seoRunning.current = false;
      setSeoBusy(false);
    }
  };
  // Autofill queues a run; it starts once the filled values have rendered into the listing.
  useEffect(() => {
    if (!seoQueued.current) return;
    seoQueued.current = false;
    void runSeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);
  // Errors from the last check stay visible until their field is fixed; fixed ones drop out as you edit.
  const stillFailing = Object.keys(errors).length
    ? new Map<string, string>(stepErrors(step).map((b) => [b.key, b.msg]))
    : null;
  const shownErrors: Record<string, string> = {};
  for (const key of Object.keys(errors)) {
    if (key === 'decl2') {
      if (!L.authorised) shownErrors[key] = errors[key];
    } else if (stillFailing?.has(key)) shownErrors[key] = stillFailing.get(key);
  }
  const t = tokens(L);
  const live = L.status === 'published';
  // Publishing always goes through review: the listing is saved as "pending" and goes live once approved.
  const publishLabel = live ? 'Submit changes for review' : 'Publish listing';
  const stepLabel = { 2: 'Location', 3: 'Property details', 4: 'Price & terms' };

  /* ---------- validation ---------- */
  function focusEl(elId) {
    setTimeout(() => {
      focusListingField(elId);
    }, 40);
  }
  function check(n) {
    const bad = [...(isAgency && n === 8 ? [] : validateEditorStep(schemaStep(n), Lref.current, user))];
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
  const formRef = useRef<HTMLFormElement>(null);
  const go = useCallback((n, focus) => {
    setStep(n);
    if (focus)
      setTimeout(() => {
        const h = document.querySelector('[data-step="' + n + '"] h2');
        (h as HTMLElement)?.focus({ preventScroll: true });
        // Land on the top of the form, below the sticky workspace bar, not on the AI section above it.
        const form = formRef.current;
        if (!form) return;
        const bar = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
        const top = form.getBoundingClientRect().top + window.scrollY - Math.max(bar, 0) - 16;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: Math.max(top, 0), behavior: reduce ? 'auto' : 'smooth' });
      }, 30);
  }, []);

  /* ---------- saving ---------- */
  /* One save at a time. Navigation saves run in the background (they don't block the next step);
   * an explicit save or publish waits for any save already in flight, so nothing is lost. */
  const inflight = useRef<Promise<any> | null>(null);
  const saveQueued = useRef(false);
  async function persist(status = undefined, background = false) {
    if (inflight.current) {
      if (background) {
        saveQueued.current = true;
        return null;
      }
      await inflight.current.catch(() => null);
    }
    const run = doPersist(status, background);
    inflight.current = run;
    try {
      return await run;
    } finally {
      if (inflight.current === run) inflight.current = null;
      if (saveQueued.current) {
        saveQueued.current = false;
        if (dirtyRef.current) void persist(undefined, true);
      }
    }
  }
  async function doPersist(status = undefined, background = false) {
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
      const agencyId = user.agency?.agencyId || user.agencyId || '';
      const previous = savedRef.current;
      const alreadyAgencyOwned = previous && Boolean(agencyId) && String(previous.ownerAgency || '') === String(agencyId);
      if (!previous || alreadyAgencyOwned) {
        obj.ownerType = 'agency';
        obj.ownerAgency = agencyId || obj.ownerAgency || '';
      } else {
        // Joining an agency must not transfer a broker's existing listings.
        obj.ownerType = previous.ownerType;
        obj.ownerAgency = previous.ownerAgency;
        obj.ownerDeveloper = previous.ownerDeveloper;
        obj.primaryBroker = previous.primaryBroker;
        obj.ownerDirect = previous.ownerDirect;
        obj.claimable = previous.claimable;
        obj.claimPolicy = previous.claimPolicy;
      }
    }
    if (status) obj.status = status;
    else if (!savedRef.current) obj.status = 'draft';
    // Price history: a change to a published price is kept so a genuine reduction can be shown publicly.
    const before = savedRef.current;
    if (before && before.status === 'published' && Number(before.price) > 0 && Number(obj.price) > 0 && Number(before.price) !== Number(obj.price)) {
      obj.priceHistory = [...(before.priceHistory || []), { price: Number(before.price), at: before.updatedAt || new Date().toISOString() }].slice(-12);
      obj.previousPrice = Number(before.price);
    }
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
    if (!background) setSaving(true);
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
  /** Save after moving to another step — never makes the user wait for the server. */
  function saveInBackground() {
    if (dirtyRef.current || !savedRef.current) void persist(undefined, true);
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

  // One click submits. The button disables immediately and stays disabled until the save finishes;
  // after a successful submit it stays disabled while the page navigates away. A background save still
  // in flight (e.g. from "Continue" to this step) doesn't swallow the click: persist() waits for it.
  const publishingRef = useRef(false);
  const [publishing, setPublishing] = useState(false);
  async function publish() {
    if (publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    let submitted = false;
    try {
      submitted = await submitForReview();
    } finally {
      if (!submitted) {
        publishingRef.current = false;
        setPublishing(false);
      }
    }
  }
  async function submitForReview(): Promise<boolean> {
    for (let n = 1; n <= totalSteps; n++) {
      if (!check(n)) {
        go(n, false);
        toast('Complete step ' + n + ' (' + stepNames[n - 1] + ') before publishing.', { icon: 'exclamation-circle' });
        setPreviewOpen(false);
        return false;
      }
    }
    const cur = Lref.current;
    const r = editorReadiness(cur, currentUser());
    if (!r.complete) {
      go(reviewStep, true);
      toast('Complete the checklist before publishing.', { icon: 'exclamation-circle' });
      setPreviewOpen(false);
      return false;
    }
    if (!cur.authorised) {
      setPreviewOpen(false);
      go(reviewStep, false);
      setErrors((e) => ({ ...e, decl2: 'Confirm you are authorised to market this property.' }));
      focusEl('designer-decl2');
      return false;
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
      return false;
    }
    Lref.current = setIn(cur, 'display.visible', cur.display?.visible !== false);
    const s = await persist('pending');
    if (!s) return false;
    log('Submitted for review “' + s.title + '”', 'hourglass-split');
    setPreviewOpen(false);
    toast(
      verified
        ? 'Saved and sent for review. It will go live once approved.'
        : 'Saved and sent for review. It will go live once your credentials are verified and the listing is approved.',
      { icon: 'hourglass-split', duration: 6000 },
    );
    router.push(routes.listing(s.id));
    return true;
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
  const reviewCard = useMemo(() => (step === reviewStep ? buildPreview(L) : null), [step, L, reviewStep]);
  const ready = editorReadiness(L, user);

  const ed = {
    L,
    t,
    errors: shownErrors,
    set: setField,
    update,
    toast,
    confirm,
    go,
    latest: () => Lref.current,
    seo: { run: runSeo, busy: seoBusy, error: seoError, issues: seoIssues },
    isDeveloper,
    user,
    developerBrokers,
    isAgency,
    agencyBrokers,
    aiPhotos,
    setAiPhotos,
  };

  const offerAiPhotos = (photos?: AiFoundPhotos) => {
    if (!photos) return 0;
    const found: AiPhoto[] = [
      ...photos.files.map((file) => ({ id: 'file:' + file.name + ':' + file.size, kind: 'file' as const, file, preview: URL.createObjectURL(file), name: file.name, source: 'Your upload' })),
      ...photos.links.map((link) => ({ id: 'link:' + link.url, kind: 'link' as const, url: link.url, preview: '/api/listing-autofill/image?url=' + encodeURIComponent(link.url), name: decodeURIComponent(link.url.split(/[?#]/)[0].split('/').pop() || 'photo').slice(0, 80), source: link.source, other: link.other })),
    ];
    setAiPhotos((current) => {
      const next = current.slice();
      for (const photo of found) {
        if (next.some((p) => p.id === photo.id)) { if (photo.kind === 'file') URL.revokeObjectURL(photo.preview); continue; }
        next.push(photo);
      }
      return next;
    });
    return found.length;
  };
  const applyAiSuggestions = (suggestions: Record<string, any>, selected: string[], candidates?: Record<string, { value: any; sources: string[] }[]>, photos?: AiFoundPhotos) => {
    const photoCount = offerAiPhotos(photos);
    const next = clone(Lref.current);
    const data = { ...next.editor.d };
    const changes = { ...aiChanges };
    const amenities = { ...(next.editor.amen || {}) };
    const amenChanges = { ...aiAmenChanges };
    const pending: Record<string, AiSuggestion> = {};
    let planChange = aiPlanChange;
    let milestones = next.editor.milestones;
    let filled = 0, kept = 0;
    // An amount and its AED / % basis belong together: if either one would need review, both do.
    const original = { ...data };
    const isBlank = (v: any) => v == null || v === '' || (Array.isArray(v) && !v.length);
    const conflicts = (k: string) => Object.prototype.hasOwnProperty.call(suggestions, k) && !isBlank(original[k]) && JSON.stringify(original[k]) !== JSON.stringify(suggestions[k]);
    const partnerOf: Record<string, string> = {};
    for (const [k, f] of Object.entries<any>(S.FIELDS)) if (f.kind === 'amt' && f.basisKey) { partnerOf[k] = f.basisKey; partnerOf[f.basisKey] = k; }
    const pairConflict = (k: string) => !!partnerOf[k] && Object.prototype.hasOwnProperty.call(suggestions, partnerOf[k]) && (conflicts(k) || conflicts(partnerOf[k]));
    // The sale price lives in one of two fields depending on the classification: unitPrice for an
    // off-plan initial (developer) sale, askingPrice otherwise. The AI sometimes uses the other one
    // (e.g. a Bayut off-plan "Initial Sale" price returned as askingPrice), which would land in a
    // hidden field. Move it to the field this listing actually shows.
    ({ suggestions, selected, candidates } = (() => {
      const has = (k: string) => Object.prototype.hasOwnProperty.call(suggestions, k) && !isBlank(suggestions[k]);
      const merged = { ...data };
      for (const k of ['purpose', 'category', 'ptype', 'devStatus', 'txn']) if (isBlank(merged[k]) && has(k)) merged[k] = suggestions[k];
      const c = S.ctxOf(merged);
      if (!c.sale) return { suggestions, selected, candidates };
      const want = c.offInit ? 'unitPrice' : 'askingPrice';
      const other = want === 'unitPrice' ? 'askingPrice' : 'unitPrice';
      if (has(want) || !has(other)) return { suggestions, selected, candidates };
      const s2 = { ...suggestions }, c2 = { ...(candidates || {}) };
      for (const [from, to] of [[other, want], [other + 'Max', want + 'Max']]) {
        if (!Object.prototype.hasOwnProperty.call(s2, from)) continue;
        s2[to] = s2[from]; delete s2[from];
        if (c2[from]) { c2[to] = c2[from]; delete c2[from]; }
      }
      const sel = selected.map((k) => (k === other ? want : k === other + 'Max' ? want + 'Max' : k));
      return { suggestions: s2, selected: [...new Set(sel)], candidates: c2 };
    })());
    for (const key of selected) {
      if (!Object.prototype.hasOwnProperty.call(suggestions, key)) continue;
      if (key === 'milestones') {
        // Only fill an empty payment plan; an existing schedule is never overwritten.
        if (!(milestones || []).length && Array.isArray(suggestions.milestones)) {
          milestones = suggestions.milestones;
          planChange = { before: next.editor.milestones, applied: milestones };
          filled++;
        } else kept++;
        continue;
      }
      if (/(Max|Multi)$/.test(key)) continue;
      if (key === 'amenities') {
        const ids = (candidates?.amenities || [{ value: suggestions.amenities }]).flatMap((candidate) => Array.isArray(candidate.value) ? candidate.value : []);
        for (const id of ids) {
          if (typeof id !== 'string' || Object.prototype.hasOwnProperty.call(amenities, id)) continue;
          const applied = { selected: true, status: data.devStatus === 'offplan' ? 'planned' : 'existing', charge: 'unknown' };
          amenChanges[id] = { before: undefined, applied };
          amenities[id] = applied;
          filled++;
        }
        continue;
      }
      const current = data[key];
      const empty = current == null || current === '' || (Array.isArray(current) && !current.length);
      const options = candidates?.[key] || [];
      if (LISTING_AI_PRIVATE_FIELDS.includes(key) || pairConflict(key) || options.length > 1 || (!empty && JSON.stringify(current) !== JSON.stringify(suggestions[key])) || (key === 'mapLocation' && empty && (data.lat || data.lng))) {
        const id = key === 'communityId' ? 'designer-community' : 'designer-' + key;
        pending[id] = { value: suggestions[key], sources: options[0]?.sources || [], options };
        continue;
      }
      if (!empty) {
        kept++;
        continue;
      }
      changes[key] = { before: changes[key]?.before ?? data[key], applied: suggestions[key] };
      data[key] = suggestions[key];
      filled++;
      if (key === 'mapLocation') {
        const coordinates = coordinatesFromMapLink(suggestions[key]);
        for (const coordinate of ['lat', 'lng']) {
          const applied = coordinates?.[coordinate] || '';
          changes[coordinate] = { before: changes[coordinate]?.before ?? data[coordinate], applied };
          data[coordinate] = applied;
        }
      }
    }
    // Range ends and extra choices follow their main field: they fill only when that field now
    // holds the AI value, so a field under review is never left half-changed.
    for (const key of selected.filter((k) => /(Max|Multi)$/.test(k))) {
      const base = key.replace(/(Max|Multi)$/, '');
      if (JSON.stringify(data[base]) !== JSON.stringify(suggestions[base])) continue;
      const current = data[key];
      if (current != null && current !== '' && !(Array.isArray(current) && !current.length)) continue;
      changes[key] = { before: changes[key]?.before ?? current, applied: suggestions[key] };
      data[key] = suggestions[key];
    }
    ed.set('editor.d', data);
    ed.set('editor.amen', amenities);
    if (planChange !== aiPlanChange) {
      ed.set('editor.milestones', milestones);
      setAiPlanChange(planChange);
    }
    setAiAmenChanges(amenChanges);
    setAiChanges(changes);
    setAiSuggestions((current) => ({ ...current, ...pending }));
    aiFirstStep.current = selected.length ? Math.min(...selected.map(stepOf)) : 1;
    toast(photoCount ? `AI suggestions are ready in the listing fields. ${photoCount} photo${photoCount === 1 ? '' : 's'} found — choose which to add in Photos & media.` : 'AI suggestions are ready in the listing fields.', photoCount ? { duration: 6000 } : undefined);
    // First autofill, then SEO: write the SEO content from what autofill found.
    if (filled || Object.keys(pending).length) seoQueued.current = true;
    // Values that differ from what's already entered wait in the fields for the user's choice.
    return { filled, missing: 0, review: Object.keys(pending).length, kept };
  };
  const applyAiSuggestion = (id: string, value?: any) => {
    const suggestion = aiSuggestions[id]; if (!suggestion) return;
    const key = id === 'designer-community' ? 'communityId' : id.replace(/^designer-/, '');
    const next = clone(Lref.current); const data = { ...next.editor.d };
    const applied = value === undefined ? suggestion.value : value;
    const change = aiChanges[key];
    const changes = { ...aiChanges, [key]: { before: change?.before ?? data[key], applied } };
    data[key] = applied;
    if (key === 'mapLocation') {
      const coordinates = coordinatesFromMapLink(applied);
      for (const coordinate of ['lat', 'lng']) {
        const value = coordinates?.[coordinate] || '';
        changes[coordinate] = { before: changes[coordinate]?.before ?? data[coordinate], applied: value };
        data[coordinate] = value;
      }
    }
    ed.set('editor.d', data); setAiChanges(changes);
    setAiSuggestions((current) => { const copy = { ...current }; delete copy[id]; return copy; });
  };
  const undoAiChanges = () => {
    const next = clone(Lref.current);
    const data = { ...next.editor.d };
    for (const [key, change] of Object.entries(aiChanges)) {
      if (JSON.stringify(data[key]) === JSON.stringify(change.applied)) data[key] = change.before;
    }
    ed.set('editor.d', data);
    const amenities = { ...(next.editor.amen || {}) };
    for (const [id, change] of Object.entries(aiAmenChanges)) {
      if (JSON.stringify(amenities[id]) === JSON.stringify(change.applied)) {
        if (change.before === undefined) delete amenities[id]; else amenities[id] = change.before;
      }
    }
    ed.set('editor.amen', amenities);
    if (aiPlanChange && JSON.stringify(next.editor.milestones) === JSON.stringify(aiPlanChange.applied))
      ed.set('editor.milestones', aiPlanChange.before || []);
    setAiPlanChange(null);
    setAiAmenChanges({});
    setAiChanges({});
    setAiSuggestions({});
    setAiPhotos((current) => { current.forEach((p) => p.kind === 'file' && URL.revokeObjectURL(p.preview)); return []; });
    toast('AI changes undone. Your later edits have been kept.');
  };
  const aiStates: Record<string, AiFieldState> = {};
  let aiFilled = 0, aiEdited = 0;
  for (const [key, change] of Object.entries(aiChanges)) {
    if (/(Max|Multi)$/.test(key)) continue;
    const state = JSON.stringify(L.editor.d[key]) === JSON.stringify(change.applied) ? 'filled' : 'edited';
    if (state === 'filled') aiFilled++; else aiEdited++;
    aiStates[key === 'communityId' ? 'designer-community' : 'designer-' + key] = state;
  }
  for (const [id, change] of Object.entries(aiAmenChanges)) {
    const state = JSON.stringify(L.editor.amen?.[id]) === JSON.stringify(change.applied) ? 'filled' : 'edited';
    if (state === 'filled') aiFilled++; else aiEdited++;
    aiStates['amenity-' + id] = state;
  }
  if (aiPlanChange) {
    const state = JSON.stringify(L.editor.milestones) === JSON.stringify(aiPlanChange.applied) ? 'filled' : 'edited';
    if (state === 'filled') aiFilled++; else aiEdited++;
  }
  for (const id of Object.keys(aiSuggestions)) aiStates[id] = 'suggestion';
  // After an AI run every field shows a state: AI-filled / Edited / AI suggestion from the AI itself,
  // "Not from AI" when it has a value the AI didn't supply, and missing (yellow optional, red required) when blank.
  const aiRan = Object.keys(aiChanges).length > 0 || Object.keys(aiAmenChanges).length > 0 || Object.keys(aiSuggestions).length > 0 || !!aiPlanChange;
  let aiMissingRequired = 0;
  if (aiRan) {
    const d = L.editor.d, c = S.ctxOf(d);
    const mark = (id: string, blank: boolean, required: boolean) => {
      if (aiStates[id]) return;
      aiStates[id] = blank ? 'missing' : 'kept';
      if (blank && required) aiMissingRequired++;
    };
    for (const key of S.activeFieldKeys(c, d)) {
      const f = S.FIELDS[key];
      const blank = f.kind === 'check' ? !d[key] : S.util.isBlank(d[key]);
      // Unticked optional boxes are a valid "no", not a gap.
      if (f.kind === 'check' && !S.isReq(f, c, d)) { if (!aiStates['designer-' + key]) aiStates['designer-' + key] = 'kept'; continue; }
      mark('designer-' + key, blank, S.isReq(f, c, d));
    }
    mark('designer-emirate', S.util.isBlank(d.emirate), true);
    mark('designer-community', S.util.isBlank(d.communityId), true);
    if (!d.proposing) mark('designer-buildingName', S.util.isBlank(d.buildingName), c.off);
    mark('designer-mapLocation', S.util.isBlank(d.mapLocation) && S.util.isBlank(d.lat), false);
    // Payment milestones: compare each row with the row the AI wrote.
    const appliedRows = new Map((aiPlanChange?.applied || []).map((row: any) => [row.id, JSON.stringify(row)]));
    for (const row of L.editor.milestones || []) {
      const state: AiFieldState = appliedRows.has(row.id) ? (appliedRows.get(row.id) === JSON.stringify(row) ? 'filled' : 'edited') : 'kept';
      for (const part of ['name', 'mode', 'value', 'trigger', 'when']) aiStates['ms-' + part + '-' + row.id] = state;
    }
    if (c.offInit) {
      const rows = L.editor.milestones || [];
      aiStates['designer-milestones'] = !rows.length ? 'missing' : aiPlanChange ? (JSON.stringify(rows) === JSON.stringify(aiPlanChange.applied) ? 'filled' : 'edited') : 'kept';
      if (!rows.length) aiMissingRequired++;
    }
    const amenFilled = Object.entries(aiAmenChanges).some(([id, change]) => JSON.stringify(L.editor.amen?.[id]) === JSON.stringify(change.applied));
    aiStates['designer-amen'] = amenFilled ? 'filled' : Object.values(L.editor.amen || {}).some((a: any) => a.selected !== false) ? 'kept' : 'missing';
    if (!(L.photos || []).length) aiMissingRequired++;
  }
  // Per-step counts for the steps bar: answers still as AI filled them, and AI suggestions awaiting review.
  const aiFilledByStep: Record<number, number> = {};
  const aiReviewByStep: Record<number, number> = {};
  const bump = (counts: Record<number, number>, n: number) => (counts[n] = (counts[n] || 0) + 1);
  for (const [key, change] of Object.entries(aiChanges)) {
    if (/(Max|Multi)$/.test(key) || key === 'lat' || key === 'lng') continue;
    if (JSON.stringify(L.editor.d[key]) === JSON.stringify(change.applied)) bump(aiFilledByStep, stepOf(key));
  }
  for (const [id, change] of Object.entries(aiAmenChanges))
    if (JSON.stringify(L.editor.amen?.[id]) === JSON.stringify(change.applied)) bump(aiFilledByStep, stepOf('amenities'));
  if (aiPlanChange && JSON.stringify(L.editor.milestones) === JSON.stringify(aiPlanChange.applied))
    bump(aiFilledByStep, stepOf('milestones'));
  if (aiPhotos.length) bump(aiReviewByStep, stepOf('photos'));
  for (const id of Object.keys(aiSuggestions))
    bump(aiReviewByStep, stepOf(id === 'designer-community' ? 'communityId' : id.replace(/^designer-/, '')));
  const aiReview = { ran: aiRan, states: aiStates, suggestions: aiSuggestions, use: (id: string) => applyAiSuggestion(id), keep: (id: string) => setAiSuggestions((current) => { const copy = { ...current }; delete copy[id]; return copy; }), select: (id: string, value: any) => setAiSuggestions((current) => ({ ...current, [id]: { ...current[id], value } })) };

  const status = STATUS[L.status] || STATUS.draft;
  const crumb = saved ? saved.title || 'Untitled listing' : 'New listing';
  const currentAgencyId = String(user.agency?.agencyId || user.agencyId || '');
  const savedAgencyId = String(saved?.ownerAgency && typeof saved.ownerAgency === 'object' ? saved.ownerAgency.id : saved?.ownerAgency || '');
  const canAssignTeamMember = !saved || (!!currentAgencyId && savedAgencyId === currentAgencyId);

  const sections = stepNames.map((_, i) => {
    const uiStep = i + 1;
    if (isAgency && uiStep === 8) return (
      <div key={uiStep}>
        <h2 className="h3" tabIndex={-1}>Assign a team member</h2>
        <p className="mt-1 text-[13px] text-muted">Choose which broker in your agency will handle this listing. Existing broker listings stay under their original owner.</p>
        <div className="mt-6 max-w-xl">
          {!canAssignTeamMember && <p className="mb-4 rounded-md border border-sage/30 bg-sage-soft/40 p-3 text-sm text-sage-ink">This listing already belongs to your broker account. Its ownership and broker assignment will stay unchanged.</p>}
          <label className="field" htmlFor="agency-listing-broker"><span className="label inline-flex flex-wrap items-center gap-2">Assigned broker <span className="opt">(optional)</span><AiStatus id="agency-listing-broker" value={L.primaryBroker || ''} optional /></span>
            <select id="agency-listing-broker" className="select" value={L.primaryBroker || ''} disabled={!canAssignTeamMember} onChange={(event) => setField('primaryBroker', event.target.value)}>
              <option value="">Keep this listing unassigned</option>
              {agencyBrokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name} · {broker.email}</option>)}
            </select>
          </label>
          {!agencyBrokers.length && <p className="mt-3 rounded-md border border-line bg-mist p-3 text-sm text-muted">No broker team members yet. Invite a broker by email to assign listings to them.</p>}
          <Link href="/agency-team" className="btn btn-outline btn-sm mt-4"><Icon name="people" />Invite or manage team members</Link>
        </div>
      </div>
    );
    return <DesignerStep key={uiStep} ed={ed} step={schemaStep(uiStep)} preview={reviewCard} ready={ready} />;
  });

  const stepDone = (k: number) => (isAgency && k === 8 ? k < step : stepErrors(k).length === 0);
  const completed = stepNames.reduce((n, _, i) => n + (i + 1 < reviewStep && stepDone(i + 1) ? 1 : 0), 0);
  const percent = Math.round((completed / Math.max(reviewStep - 1, 1)) * 100);
  const currentName = stepNames[step - 1];
  const tips = STEP_TIPS[currentName];
  const goToStep = (k: number) => {
    if (k > step && !check(step)) return;
    if (k !== step) setErrors({});
    go(k, true);
    if (k > step) saveInBackground();
  };

  return (
    <AiReviewContext.Provider value={aiReview}>
    <div className="listing-editor mx-auto max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-10">
      <nav className="mb-3 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/listings" className="hover:text-ink">
          My Listings
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{crumb}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="listing-editor-title">{saved ? 'Edit property' : 'Create a listing'}</h1>
            <span className={'badge ' + status.cls}>{status.label}</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Icon name={dirty ? "pencil" : "cloud-check"} />
            {note.warn ? <span className="text-warn">{note.text}</span> : note.text}
            {dirty && <span className="text-muted"> · unsaved changes</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost text-danger hover:bg-danger-soft" onClick={discardDraft}>
            <Icon name="trash3" /> Discard
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setPreviewOpen(true)}>
            <Icon name="eye" />
            Preview
          </button>
          <button type="button" className="btn btn-dark" disabled={saving} onClick={saveDraft}>
            <Icon name={saving ? 'hourglass-split' : 'floppy'} />
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <AiAutofill
          id="listing-ai"
          context="listing"
          current={L.editor.d}
          onApply={applyAiSuggestions}
          onReview={() => go(aiFirstStep.current, true)}
          onUndo={undoAiChanges}
          onManual={() => go(1, true)}
          hideSummary
        />
        {(Object.keys(aiChanges).length > 0 || Object.keys(aiAmenChanges).length > 0 || Object.keys(aiSuggestions).length > 0 || !!aiPlanChange) && <AiNotice filled={aiFilled} edited={aiEdited} missing={aiMissingRequired} review={Object.keys(aiSuggestions).length} onUndo={undoAiChanges} />}
        {seoBusy && (
          <p className="flex items-center gap-2 text-[13px] text-muted" role="status">
            <Icon name="stars" />
            Writing the SEO title, description and FAQ from these details…
          </p>
        )}
        {!seoBusy && seoError && (
          <p className="text-[13px] text-warn" role="alert">
            SEO: {seoError}{' '}
            <button type="button" className="underline" onClick={() => void runSeo()}>
              Try again
            </button>
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[272px_minmax(0,1fr)] 2xl:grid-cols-[272px_minmax(0,1fr)_288px]">
        {/* Step navigation: compact progress on small screens, a vertical stepper from lg up. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="le-progress card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold text-ink">
                <span className="lg:hidden">
                  Step {step} of {totalSteps} · {currentName}
                </span>
                <span className="hidden lg:inline">Your listing</span>
              </p>
              <p className="text-xs text-muted">
                <span className="font-semibold text-ink">{percent}%</span> complete
              </p>
            </div>
            <div
              className="le-progress-track mt-3"
              role="progressbar"
              aria-label="Listing completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span style={{ width: percent + '%' }} />
            </div>
          </div>

          <ol
            className="le-steps no-scrollbar mt-3 flex gap-1.5 overflow-x-auto lg:mt-4 lg:flex-col lg:gap-0 lg:overflow-visible"
            aria-label="Listing steps"
          >
            {stepNames.map((name, i) => {
              const k = i + 1;
              const current = k === step;
              const done = !current && stepDone(k);
              return (
                <li key={k} className={cx('le-step-item', done && 'is-done', current && 'is-current')}>
                  <button
                    type="button"
                    className={cx('le-step', current && 'is-current', done && 'is-done')}
                    aria-current={current ? 'step' : undefined}
                    disabled={saving}
                    onClick={() => goToStep(k)}
                  >
                    <span className="le-step-dot" aria-hidden="true">
                      {done ? <Icon name="check-lg" /> : k}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('le-step-name', !current && 'max-lg:sr-only')}>
                        {stepLabel[k] || name}
                        {done && <span className="sr-only"> (complete)</span>}
                      </span>
                      {STEP_HINTS[name] && <span className="le-step-hint">{STEP_HINTS[name]}</span>}
                    </span>
                    {(aiFilledByStep[k] > 0 || aiReviewByStep[k] > 0) && (
                      <span className="hidden shrink-0 items-center gap-1 lg:inline-flex">
                        {aiFilledByStep[k] > 0 && (
                          <span
                            className="inline-flex h-5 items-center gap-0.5 rounded-full bg-[#ecebff] px-1.5 text-[10px] font-semibold text-[#4338a8]"
                            title={`${aiFilledByStep[k]} field${aiFilledByStep[k] === 1 ? '' : 's'} filled by AI`}
                          >
                            <Icon name="stars" aria-hidden="true" />
                            {aiFilledByStep[k]}
                            <span className="sr-only"> filled by AI</span>
                          </span>
                        )}
                        {aiReviewByStep[k] > 0 && (
                          <span
                            className="inline-flex h-5 items-center gap-0.5 rounded-full bg-warn-soft px-1.5 text-[10px] font-semibold text-warn"
                            title={`${aiReviewByStep[k]} AI suggestion${aiReviewByStep[k] === 1 ? '' : 's'} to review`}
                          >
                            <Icon name="exclamation-circle" aria-hidden="true" />
                            {aiReviewByStep[k]}
                            <span className="sr-only"> to review</span>
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <form
          ref={formRef}
          className="listing-editor-panel card min-w-0 scroll-mt-24"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < totalSteps && check(step)) {
              go(step + 1, true);
              saveInBackground();
            }
          }}
        >
          <div className="p-5 sm:p-7 lg:p-9">
            <p className="le-step-eyebrow">
              Step {step} of {totalSteps}
            </p>
            {sections.map((s, i) => (
              <section key={i} data-step={i + 1} hidden={step !== i + 1}>
                {s}
              </section>
            ))}

            {Object.keys(shownErrors).length > 0 && (
              <button
                type="button"
                className="mt-8 flex w-full items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-left text-sm font-medium text-danger"
                onClick={() => {
                  const first = document.querySelector(
                    '[data-step="' + step + '"] .field.invalid, [data-step="' + step + '"] .err:not(:empty)',
                  );
                  const target = first?.querySelector('input, select, textarea, button') || first;
                  if (target) {
                    const id = (target as HTMLElement).id;
                    if (id) focusListingField(id);
                    else target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }
                }}
              >
                <Icon name="exclamation-circle" />
                <span className="flex-1">
                  {Object.keys(shownErrors).length === 1
                    ? '1 field in this step needs attention.'
                    : Object.keys(shownErrors).length + ' fields in this step need attention.'}
                </span>
                <span className="text-xs underline">Show me</span>
              </button>
            )}
          </div>

          {/* Sticky action bar: Back · progress · Continue, always in reach on long steps. */}
          <div className="le-actions">
            <div className="le-actions-segments" aria-hidden="true">
              {stepNames.map((_, i) => (
                <span key={i} className={cx(i + 1 < step && 'is-past', i + 1 === step && 'is-current')} />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-7 lg:px-9">
              {step > 1 ? (
                <button type="button" className="btn btn-outline" onClick={() => { setErrors({}); go(step - 1, true); }}>
                  <Icon name="arrow-left" />
                  Back
                </button>
              ) : (
                <span />
              )}
              <span className="hidden text-xs text-muted sm:inline">
                {step < totalSteps ? (
                  <>
                    Next: <span className="font-semibold text-ink">{stepNames[step]}</span>
                  </>
                ) : (
                  'Last step'
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                {step === reviewStep ? (
                  <>
                    <button type="button" className="btn btn-outline" onClick={() => setPreviewOpen(true)}>
                      <Icon name="eye" />
                      Preview
                    </button>
                    <button type="button" className="btn btn-dark btn-lg" disabled={publishing} aria-busy={publishing} onClick={publish}>
                      <Icon name={publishing ? 'hourglass-split' : 'send'} />
                      {publishing ? 'Submitting…' : publishLabel}
                    </button>
                  </>
                ) : (
                  <button type="submit" className="btn btn-dark btn-lg">
                    Continue
                    <Icon name="arrow-right" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

        {tips && (
          <aside className="hidden 2xl:sticky 2xl:top-24 2xl:block 2xl:self-start" aria-label="Tips for this step">
            <div className="le-tips card p-5">
              <span className="le-tips-icon" aria-hidden="true">
                <Icon name="lightbulb" />
              </span>
              <p className="mt-3 text-[15px] font-semibold text-ink">{tips.title}</p>
              <ul className="mt-3 space-y-2.5">
                {tips.tips.map((t) => (
                  <li key={t} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                    <Icon name="check2" className="mt-0.5 shrink-0 text-sage-ink" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        getListing={previewListing}
        complete={ready.complete}
        publishLabel={publishLabel}
        onSave={saveDraft}
        onPublish={publish}
        publishing={publishing}
      />
    </div>
    </AiReviewContext.Provider>
  );
}
