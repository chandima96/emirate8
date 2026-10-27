'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Field, invalidProps } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PropertyCard } from '@/components/property/PropertyCard';
import { AMENITY_GROUPS, CATEGORY_AMENITY_GROUPS, HIGHLIGHTS, MAX_HIGHLIGHTS } from '@/config/reference';
import { cx, slugify } from '@/lib/utils';
import { uploadMediaFile } from '@/lib/mediaClient';

/* ---------- 5 Marketing ---------- */
export function StepMarketing({ ed }) {
  const { L, t, set, toast } = ed;
  const [custom, setCustom] = useState('');
  const [customAmenity, setCustomAmenity] = useState('');
  const [customAmenityCategory, setCustomAmenityCategory] = useState('');
  const [term, setTerm] = useState('');
  const all = HIGHLIGHTS.concat(L.highlights.filter((h) => HIGHLIGHTS.indexOf(h) < 0));

  const toggleHighlight = (h) => {
    const i = L.highlights.indexOf(h);
    if (i > -1)
      set(
        'highlights',
        L.highlights.filter((x) => x !== h),
      );
    else if (L.highlights.length >= MAX_HIGHLIGHTS)
      toast('Choose up to ' + MAX_HIGHLIGHTS + ' highlights — remove one first.', { icon: 'exclamation-circle' });
    else set('highlights', [...L.highlights, h]);
  };
  const addCustom = () => {
    const v = custom.trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (L.highlights.length >= MAX_HIGHLIGHTS) {
      toast('Choose up to ' + MAX_HIGHLIGHTS + ' highlights.', { icon: 'exclamation-circle' });
      return;
    }
    if (L.highlights.map((x) => x.toLowerCase()).indexOf(v.toLowerCase()) < 0) set('highlights', [...L.highlights, v]);
    else set('highlights', L.highlights);
    setCustom('');
  };
  const toggleAmenity = (a, on) => {
    const has = L.amenities.indexOf(a) > -1;
    if (on && !has) set('amenities', [...L.amenities, a]);
    if (!on && has)
      set(
        'amenities',
        L.amenities.filter((x) => x !== a),
      );
  };
  const addCustomAmenity = () => {
    const value = customAmenity.trim().replace(/\s+/g, ' ');
    if (!value) return;
    if (!customAmenityCategory) {
      toast('Choose a category for this amenity first.', { icon: 'exclamation-circle' });
      return;
    }
    const existing = L.amenities.find((item) => item.toLowerCase() === value.toLowerCase());
    const label = existing || value;
    ed.update((prev) => ({
      ...prev,
      amenities: existing ? prev.amenities : [...prev.amenities, label],
      amenityCategories: { ...(prev.amenityCategories || {}), [label]: customAmenityCategory },
    }));
    setCustomAmenity('');
    setCustomAmenityCategory('');
  };
  const q = term.toLowerCase();
  const amenityGroups = CATEGORY_AMENITY_GROUPS[L.category] || AMENITY_GROUPS;
  const categoryNames = Object.keys(amenityGroups);
  const seenAmenities = new Set();
  const builtInAmenities = Object.keys(amenityGroups).reduce((all, group) => all.concat(amenityGroups[group]), []);
  const groups = [...categoryNames, 'Custom']
    .map((g) => {
      const customInGroup = L.amenities.filter(
        (a) => !builtInAmenities.includes(a) && (L.amenityCategories?.[a] || 'Custom') === g,
      );
      const items = (amenityGroups[g] || [])
        .concat(customInGroup)
        .filter((a) => {
          if (seenAmenities.has(a)) return false;
          seenAmenities.add(a);
          return true;
        })
        .filter((a) => !q || a.toLowerCase().indexOf(q) > -1 || g.toLowerCase().indexOf(q) > -1);
      return [g, items];
    })
    .filter(([, items]) => items.length);

  return (
    <>
      <h2 className="h3" tabIndex={-1}>
        Marketing
      </h2>
      <p className="mt-1 text-[13px] text-muted">Highlights and amenities help buyers filter and compare.</p>
      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <span className="label mb-0">Featured highlights</span>
          <span className="text-2xs text-muted">
            {L.highlights.length} / {MAX_HIGHLIGHTS} selected
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Highlights">
          {all.map((h) => {
            const on = L.highlights.indexOf(h) > -1;
            return (
              <button key={h} type="button" className="tog-chip" aria-pressed={on} onClick={() => toggleHighlight(h)}>
                {on && <Icon name="check-lg" className="h-3.5 w-3.5" />}
                {h}
                {HIGHLIGHTS.indexOf(h) < 0 && <span className="sr-only"> (custom)</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex max-w-[420px] gap-2">
          <label className="sr-only" htmlFor="f-hl-custom">
            Custom highlight
          </label>
          <input
            id="f-hl-custom"
            className="input h-9 text-[13px]"
            maxLength={30}
            placeholder="Add your own (max 30 characters)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <button type="button" className="btn btn-outline btn-sm h-9" onClick={addCustom}>
            Add
          </button>
        </div>
      </div>
      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <span className="label mb-0">
            Amenities{' '}
            <span className="font-normal text-muted">
              {L.amenities.length ? '· ' + L.amenities.length + ' selected' : ''}
            </span>
          </span>
          <div className="relative w-full max-w-[260px]">
            <label className="sr-only" htmlFor="f-am-q">
              Search amenities
            </label>
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            />
            <input
              id="f-am-q"
              type="search"
              className="input h-9 pl-8 text-[13px]"
              placeholder="Search amenities"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
          </div>
        </div>
        <div className="mt-3 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {groups.length ? (
            groups.map(([g, items]) => (
              <fieldset key={g}>
                <legend className="mb-2 text-[13px] font-semibold text-ink">{g}</legend>
                <div className="grid gap-1.5">
                  {items.map((a) => {
                    const id = 'am-' + slugify(a);
                    return (
                      <label key={a} className="check" htmlFor={id}>
                        <input
                          type="checkbox"
                          id={id}
                          value={a}
                          checked={L.amenities.indexOf(a) > -1}
                          onChange={(e) => toggleAmenity(a, e.target.checked)}
                        />
                        <span>{a}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))
          ) : (
            <p className="text-[13px] text-muted">No amenities match “{term.toLowerCase()}”.</p>
          )}
        </div>
        <div className="mt-4 grid max-w-[760px] gap-2 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
          <label className="sr-only" htmlFor="f-am-custom">Custom amenity</label>
          <input
            id="f-am-custom"
            className="input h-9 text-[13px]"
            maxLength={50}
            placeholder="Add custom amenity"
            value={customAmenity}
            onChange={(e) => setCustomAmenity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())}
          />
          <label className="sr-only" htmlFor="f-am-category">Amenity category</label>
          <select
            id="f-am-category"
            className="select h-9 text-[13px]"
            value={categoryNames.includes(customAmenityCategory) || customAmenityCategory === 'Custom' ? customAmenityCategory : ''}
            onChange={(e) => setCustomAmenityCategory(e.target.value)}
          >
            <option value="">Choose category</option>
            {categoryNames.map((category) => <option key={category} value={category}>{category}</option>)}
            <option value="Custom">Custom</option>
          </select>
          <button type="button" className="btn btn-outline btn-sm h-9" onClick={addCustomAmenity}>Add</button>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Field id="f-keypoints" label="Key selling points" optional="one per line">
          <textarea
            id="f-keypoints"
            className="textarea"
            value={L.keyPoints || ''}
            placeholder={'Vacant and ready to move in\nTwo balconies'}
            onChange={(e) => set('keyPoints', e.target.value)}
          />
        </Field>
        <Field id="f-nearby" label="Nearby attractions">
          <textarea
            id="f-nearby"
            className="textarea"
            value={L.nearbyNote || ''}
            placeholder="e.g. 5-minute walk to the metro and Marina Walk"
            onChange={(e) => set('nearbyNote', e.target.value)}
          />
        </Field>
        {t.offplan && (
          <Field
            id="f-devhl"
            label="Developer & investment highlights"
            optional="only what you can substantiate"
            className="sm:col-span-2"
          >
            <textarea
              id="f-devhl"
              className="textarea min-h-[80px]"
              value={L.offplan.developerHighlights || ''}
              placeholder="e.g. Escrow-registered project; handover track record on previous phases"
              onChange={(e) => set('offplan.developerHighlights', e.target.value)}
            />
          </Field>
        )}
      </div>
    </>
  );
}

/* ---------- 7 Permit & display ---------- */
export function StepPermit({ ed }) {
  const { L, set, update, errors, isDeveloper, developerBrokers = [], isAgency, agencyBrokers = [] } = ed;
  const [uploading, setUploading] = useState(false);
  const document = L.permit.document;
  const chooseRepresentation = (ownerDirect) =>
    update((prev) => ({
      ...prev,
      ownerType: 'developer',
      ownerDirect,
      claimable: ownerDirect,
      primaryBroker: ownerDirect ? '' : prev.primaryBroker,
    }));
  const choosePrimaryBroker = (value) =>
    update((prev) => ({
      ...prev,
      ownerType: 'developer',
      ownerDirect: false,
      claimable: false,
      primaryBroker: value,
    }));
  const uploadDocument = async (file) => {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 20 * 1048576) {
      ed.toast('Upload a PDF, JPG or PNG permit document under 20 MB.', { icon: 'exclamation-circle' });
      return;
    }
    setUploading(true);
    try {
      const media = await uploadMediaFile(file, file.name, 'Real estate advertising permit');
      set('permit.document', { ...media, mimetype: file.type });
      ed.toast('Advertising permit uploaded.', { icon: 'check-circle' });
    } catch (error) {
      ed.toast(error instanceof Error ? error.message : 'Could not upload the advertising permit.', { icon: 'exclamation-circle' });
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <h2 className="h3" tabIndex={-1}>
        Permit &amp; display settings
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        Advertising in Dubai requires a valid Trakheesi permit. Enter the permit details exactly as shown on the
        permit e-Certificate and upload the document for review.
      </p>
      {isDeveloper && (
        <div className="mt-6 rounded-xl border border-sage/40 bg-mist/60 p-4 sm:p-5">
          <p className="label">Developer representation</p>
          <p className="mt-1 text-[13px] text-muted">
            Choose who represents this property when it appears in search. This is part of the same property flow;
            you can change it before publishing.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={cx(
                'rounded-lg border p-4 text-left transition-colors',
                L.ownerDirect ? 'border-ink bg-white shadow-sm' : 'border-line bg-white/60 hover:border-ink',
              )}
              onClick={() => chooseRepresentation(true)}
              aria-pressed={L.ownerDirect === true}
            >
              <span className="flex items-start gap-3">
                <Icon name="building" className="mt-0.5 h-5 w-5 text-sage-ink" />
                <span>
                  <span className="block text-[13px] font-semibold text-ink">Publish as public developer inventory</span>
                  <span className="mt-1 block text-xs text-muted">Show the developer as owner and allow approved brokers to request a claim.</span>
                </span>
              </span>
            </button>
            <button
              type="button"
              className={cx(
                'rounded-lg border p-4 text-left transition-colors',
                !L.ownerDirect ? 'border-ink bg-white shadow-sm' : 'border-line bg-white/60 hover:border-ink',
              )}
              onClick={() => chooseRepresentation(false)}
              aria-pressed={L.ownerDirect === false}
            >
              <span className="flex items-start gap-3">
                <Icon name="person-badge" className="mt-0.5 h-5 w-5 text-sage-ink" />
                <span>
                  <span className="block text-[13px] font-semibold text-ink">Assign a primary broker</span>
                  <span className="mt-1 block text-xs text-muted">The selected broker becomes the main contact for this property.</span>
                </span>
              </span>
            </button>
          </div>
          {!L.ownerDirect && (
            <Field id="f-primary-broker" label="Primary broker" error={errors.primaryBroker}>
              <select
                id="f-primary-broker"
                className="select"
                value={L.primaryBroker || ''}
                onChange={(event) => choosePrimaryBroker(event.target.value)}
                {...invalidProps('f-primary-broker', errors.primaryBroker)}
              >
                <option value="">Select a current broker</option>
                {developerBrokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name}
                  </option>
                ))}
              </select>
              {!developerBrokers.length && <p className="mt-2 text-xs text-muted">No verified brokers are available yet.</p>}
            </Field>
          )}
        </div>
      )}
      {isAgency && (
        <div className="mt-6 rounded-xl border border-sage/40 bg-mist/60 p-4 sm:p-5">
          <p className="label">Agency representation</p>
          <p className="mt-1 text-[13px] text-muted">Assign this listing to a broker on your agency team. The selected broker will be shown as its primary contact.</p>
          <Field id="f-agency-primary-broker" label="Primary broker">
            <select id="f-agency-primary-broker" className="select" value={L.primaryBroker || ''} onChange={(event) => set('primaryBroker', event.target.value)}>
              <option value="">No primary broker assigned</option>
              {agencyBrokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}{broker.email ? ` · ${broker.email}` : ''}</option>)}
            </select>
            {!agencyBrokers.length && <p className="mt-2 text-xs text-muted">No broker team members are available to assign yet. Add a broker to your team first.</p>}
          </Field>
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field id="f-permit" label="Advertising permit number" error={errors['permit.number']}>
          <input
            id="f-permit"
            className="input"
            value={L.permit.number || ''}
            placeholder="e.g. 7110042318"
            onChange={(e) => set('permit.number', e.target.value)}
            {...invalidProps('f-permit', errors['permit.number'])}
          />
        </Field>
        <Field id="f-permit-doc" label="Advertising permit document" error={errors['permit.document']}>
          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-line px-4 py-3 hover:border-ink">
            <span className="min-w-0 text-sm">
              <span className="block truncate font-semibold">{document?.filename || 'Choose permit e-Certificate'}</span>
              <span className="mt-1 block text-xs text-muted">PDF, JPG or PNG · max 20 MB</span>
            </span>
            <span className="btn btn-outline btn-sm shrink-0">{uploading ? 'Uploading…' : 'Upload'}</span>
            <input
              id="f-permit-doc"
              type="file"
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              disabled={uploading}
              onChange={(event) => {
                void uploadDocument(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          {document?.url && (
            <a href={document.url} target="_blank" rel="noreferrer" className="link mt-2 block truncate text-xs">
              View uploaded permit
            </a>
          )}
        </Field>
        <Field id="f-permit-exp" label="Permit expiry" error={errors['permit.expiry']}>
          <input
            id="f-permit-exp"
            type="date"
            className="input"
            value={L.permit.expiry || ''}
            onChange={(e) => set('permit.expiry', e.target.value)}
            {...invalidProps('f-permit-exp', errors['permit.expiry'])}
          />
        </Field>
        <Field id="f-ref" label="Your reference" optional="optional">
          <input
            id="f-ref"
            className="input"
            value={L.brokerRef || ''}
            placeholder="Internal reference"
            onChange={(e) => set('brokerRef', e.target.value)}
          />
        </Field>
        <Field id="f-contact" label="Preferred contact for this listing">
          <select
            id="f-contact"
            className="select"
            value={L.display.contact || 'any'}
            onChange={(e) => set('display.contact', e.target.value)}
          >
            <option value="any">Show email, call and WhatsApp</option>
            <option value="whatsapp">WhatsApp and email only</option>
            <option value="call">Call and email only</option>
            <option value="email">Email enquiries only</option>
          </select>
        </Field>
      </div>
      <div className="mt-6 divide-y divide-line rounded-lg border border-line">
        <label className="flex cursor-pointer items-center justify-between gap-4 p-4" htmlFor="f-visible">
          <span>
            <span className="block text-[13px] font-semibold text-ink">Public visibility</span>
            <span className="block text-xs text-muted">
              When off, the listing stays in your workspace but is hidden from search and your portfolio.
            </span>
          </span>
          <span className="relative">
            <input
              id="f-visible"
              type="checkbox"
              className="peer sr-only"
              checked={L.display.visible !== false}
              onChange={(e) => set('display.visible', e.target.checked)}
            />
            <span className="toggle" aria-hidden="true" />
          </span>
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4 p-4" htmlFor="f-featured">
          <span>
            <span className="block text-[13px] font-semibold text-ink">Feature on my portfolio</span>
            <span className="block text-xs text-muted">
              Featured listings show a badge and appear first on your public portfolio.
            </span>
          </span>
          <span className="relative">
            <input
              id="f-featured"
              type="checkbox"
              className="peer sr-only"
              checked={!!L.display.portfolioFeatured}
              onChange={(e) => set('display.portfolioFeatured', e.target.checked)}
            />
            <span className="toggle" aria-hidden="true" />
          </span>
        </label>
        <div className={cx('field p-4', errors.authorised && 'invalid')}>
          <label className="flex cursor-pointer items-start gap-3" htmlFor="f-auth">
            <input
              id="f-auth"
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#142326]"
              checked={!!L.authorised}
              onChange={(e) => set('authorised', e.target.checked)}
              {...invalidProps('f-auth', errors.authorised)}
            />
            <span className="text-[13px]">
              <span className="block font-semibold text-ink">
                I hold the owner’s or developer’s authorisation to market this property
              </span>
              <span className="block text-xs text-muted">Required to publish.</span>
            </span>
          </label>
          {errors.authorised && (
            <p className="err" id="f-auth-err" role="alert">
              <Icon name="exclamation-circle" className="h-3.5 w-3.5" />
              <span>{errors.authorised}</span>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- 8 Review & publish ---------- */
const STEP_OF = { classify: 1, location: 2, details: 3, pricing: 4, plan: 4, media: 6, permit: 7 };

function CheckRow({ ok, label, children }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <Icon
        name={ok ? 'check-circle-fill' : 'circle'}
        className={'mt-0.5 h-4 w-4 shrink-0 ' + (ok ? 'text-ok' : 'text-muted')}
      />
      <span className={cx('flex-1', !ok && 'text-muted')}>{label}</span>
      {children}
    </li>
  );
}

export function StepReview({ ed, preview, ready }) {
  const { L, go } = ed;
  const fix = (n) => (
    <button
      type="button"
      className="text-xs font-semibold text-ink underline underline-offset-4"
      onClick={() => go(n, true)}
    >
      Fix
    </button>
  );
  let note;
  if (ready.publishable && L.authorised)
    note = [
      'bg-ok-soft text-ok',
      L.display.visible === false
        ? 'Ready to publish. Public visibility is off, so it will stay hidden until you switch it on.'
        : 'Everything is ready. Publishing shows this listing in search and on your public portfolio.',
    ];
  else if (ready.complete && L.authorised)
    note = [
      'bg-warn-soft text-warn',
      'Complete. Your credentials are still being verified, so it will be submitted for review and publish once you’re verified.',
    ];
  else note = ['bg-mist text-muted', 'Some required details are missing. Save as a draft and come back any time.'];

  return (
    <>
      <h2 className="h3" tabIndex={-1}>
        Review &amp; publish
      </h2>
      <p className="mt-1 text-[13px] text-muted">Check everything, preview it as buyers will see it, then publish.</p>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <p className="label">How it appears in search</p>
          <div className="max-w-[340px]">{preview && <PropertyCard listing={preview} preview />}</div>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Publishing checklist</p>
          <ul className="mt-3 space-y-2">
            {ready.checks.map((c) => (
              <CheckRow key={c.key} ok={c.ok} label={c.label}>
                {!c.ok && (c.step || STEP_OF[c.key])
                  ? fix(c.step || STEP_OF[c.key])
                  : !c.ok &&
                    c.key === 'verified' && (
                      <Link
                        className="text-xs font-semibold text-ink underline underline-offset-4"
                        href="/account#credentials"
                      >
                        Status
                      </Link>
                    )}
              </CheckRow>
            ))}
            <CheckRow ok={!!L.authorised} label="Marketing authorisation confirmed">
              {!L.authorised && fix(8)}
            </CheckRow>
          </ul>
          <div className={'mt-4 rounded-lg p-3 text-xs leading-[1.55] ' + note[0]}>{note[1]}</div>
        </div>
      </div>
    </>
  );
}
