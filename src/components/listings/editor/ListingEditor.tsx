'use client';

import { coordinatesFromMapLink } from './DesignerWidgets';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { AiBanner, AiField as Field, AiNotice, AiReviewContext, type AiFieldState, type AiSuggestion } from '@/components/ui/AiAssist';
import { ProfileAutofill } from '@/components/workspace/ProfileAutofill';
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
import { listingSchema as S } from './designer-schema';
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
  const [aiOpen, setAiOpen] = useState(false);
  const openAi = () => {
    setAiOpen(true);
    setTimeout(() => document.getElementById('listing-ai-intake')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
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
  const publishLabel = live ? 'Update published listing' : verified ? 'Publish listing' : 'Submit for review';
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
    for (let n = 1; n <= totalSteps; n++) {
      if (!check(n)) {
        go(n, false);
        toast('Complete step ' + n + ' (' + stepNames[n - 1] + ') before publishing.', { icon: 'exclamation-circle' });
        setPreviewOpen(false);
        return;
      }
    }
    const cur = Lref.current;
    const r = editorReadiness(cur, currentUser());
    if (!r.complete) {
      go(reviewStep, true);
      toast('Complete the checklist before publishing.', { icon: 'exclamation-circle' });
      setPreviewOpen(false);
      return;
    }
    if (!cur.authorised) {
      setPreviewOpen(false);
      go(reviewStep, false);
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
    isDeveloper,
    user,
    developerBrokers,
    isAgency,
    agencyBrokers,
  };

  const applyAiSuggestions = (suggestions: Record<string, any>, selected: string[], candidates?: Record<string, { value: any; sources: string[] }[]>) => {
    const next = clone(Lref.current);
    const data = { ...next.editor.d };
    const changes = { ...aiChanges };
    const amenities = { ...(next.editor.amen || {}) };
    const amenChanges = { ...aiAmenChanges };
    const pending: Record<string, AiSuggestion> = {};
    let planChange = aiPlanChange;
    let milestones = next.editor.milestones;
    for (const key of selected) {
      if (!Object.prototype.hasOwnProperty.call(suggestions, key)) continue;
      if (key === 'milestones') {
        // Only fill an empty payment plan; an existing schedule is never overwritten.
        if (!(milestones || []).length && Array.isArray(suggestions.milestones)) {
          milestones = suggestions.milestones;
          planChange = { before: next.editor.milestones, applied: milestones };
        }
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
        }
        continue;
      }
      const current = data[key];
      const empty = current == null || current === '' || (Array.isArray(current) && !current.length);
      const options = candidates?.[key] || [];
      if (options.length > 1 || (!empty && JSON.stringify(current) !== JSON.stringify(suggestions[key])) || (key === 'mapLocation' && empty && (data.lat || data.lng))) {
        const id = key === 'communityId' ? 'designer-community' : 'designer-' + key;
        pending[id] = { value: suggestions[key], sources: options[0]?.sources || [], options };
        continue;
      }
      if (!empty) continue;
      changes[key] = { before: changes[key]?.before ?? data[key], applied: suggestions[key] };
      data[key] = suggestions[key];
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
    setAiOpen(false);
    const firstStep = selected.length ? Math.min(...selected.map(stepOf)) : 1;
    go(firstStep, true);
    toast('AI suggestions are ready in the listing fields.');
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
  for (const id of Object.keys(aiSuggestions))
    bump(aiReviewByStep, stepOf(id === 'designer-community' ? 'communityId' : id.replace(/^designer-/, '')));
  const aiReview = { states: aiStates, suggestions: aiSuggestions, use: (id: string) => applyAiSuggestion(id), keep: (id: string) => setAiSuggestions((current) => { const copy = { ...current }; delete copy[id]; return copy; }), select: (id: string, value: any) => setAiSuggestions((current) => ({ ...current, [id]: { ...current[id], value } })) };

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
          <label className="field" htmlFor="agency-listing-broker"><span className="label">Assigned broker <span className="opt">(optional)</span></span>
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

  return (
    <AiReviewContext.Provider value={aiReview}>
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

      <div className="mt-6 space-y-4">
        <AiBanner kind="listing" open={aiOpen} controls="listing-ai-intake" onStart={openAi} onManual={() => { setAiOpen(false); go(1, true); }} />
        {aiOpen && <ProfileAutofill id="listing-ai-intake" kind="listing" profile={L.editor.d} onApply={applyAiSuggestions} onClose={() => setAiOpen(false)} />}
        {(Object.keys(aiChanges).length > 0 || Object.keys(aiAmenChanges).length > 0 || Object.keys(aiSuggestions).length > 0 || !!aiPlanChange) && <AiNotice filled={aiFilled} edited={aiEdited} review={Object.keys(aiSuggestions).length} onUndo={undoAiChanges} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)]">
        <ol
          className="no-scrollbar flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:gap-0.5 lg:self-start"
          aria-label="Listing steps"
        >
          {stepNames.map((name, i) => {
            const k = i + 1;
            return (
              <li key={k}>
                <button
                  type="button"
                  className={cx(
                    'wz-step flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] whitespace-nowrap',
                    k === step && 'is-current',
                    k !== step && (isAgency && k === 8 ? k < step : stepErrors(k).length === 0) && 'is-done',
                  )}
                  aria-current={k === step ? 'step' : undefined}
                  disabled={saving}
                  onClick={async () => {
                    if (k > step && !check(step)) return;
                    if (k > step && !(await autosave())) return;
                    if (k !== step) setErrors({});
                    go(k, true);
                  }}
                >
                  <span className="step-dot">{k}</span>
                  {stepLabel[k] || name}
                  {(aiFilledByStep[k] > 0 || aiReviewByStep[k] > 0) && (
                    <span className="ml-auto inline-flex items-center gap-1 pl-2">
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

        <form
          className="listing-editor-panel card min-w-0 p-5 sm:p-7 lg:p-8"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (savingRef.current) return;
            if (step < totalSteps && check(step)) {
              if (!(await autosave())) return;
              go(step + 1, true);
            }
          }}
        >
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
          <div className={cx('flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5', Object.keys(shownErrors).length > 0 ? 'mt-4' : 'mt-8')}>
            {step > 1 && (
              <button type="button" className="btn btn-ghost" onClick={() => { setErrors({}); go(step - 1, true); }}>
                <Icon name="arrow-left" />
                Back
              </button>
            )}
            <span className="text-xs text-muted">
              Step {step} of {totalSteps} · {stepNames[step - 1]}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {step === reviewStep ? (
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
    </AiReviewContext.Provider>
  );
}
