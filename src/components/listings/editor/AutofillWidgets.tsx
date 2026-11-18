'use client';

/* Listing editor widgets that fill answers automatically: market status, the building / project catalogue,
 * off-plan unit types, area units and translation. Every automatic fill records its source in `editor.sources` for the review step. */
import { useContext, useEffect, useRef, useState } from 'react';
import { AiField as Field, AiReviewContext } from '@/components/ui/AiAssist';
import { Field as PlainField } from '@/components/ui/Field';
import { invalidProps } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { AiCreditsBadge, readAiResponse, useAiCredits } from '@/components/ai/AiCredits';
import { listingSchema as S } from './designer-schema';
import { SOURCE_LABEL } from './listing-derive';

const U = S.util;
const blank = (v: unknown) => U.isBlank(v as any);

function withSources(editor: any, keys: string[], source: string) {
  const sources = { ...(editor.sources || {}) };
  keys.forEach((key) => (sources[key] = source));
  return sources;
}

/* ---------- Market status (development status + sale transaction in one choice) ---------- */
export function MarketStatusWidget({ ed }) {
  const d = ed.L.editor.d,
    c = S.ctxOf(d);
  const options: [string, string, string, string][] = c.land
    ? [
        ['', 'initial', 'First sale', 'Sold by the developer or master developer.'],
        ['', 'resale', 'Resale', 'Sold by a later owner.'],
      ]
    : c.rent
      ? [
          ['ready', '', 'Ready / Completed', 'Construction is complete.'],
          ['offplan', '', 'Off-plan / Not yet completed', 'Planned or under construction.'],
        ]
      : [
          ['ready', 'resale', 'Ready · Resale', 'Completed, sold by an owner.'],
          ['ready', 'initial', 'Ready · First sale', 'Completed, sold by the developer.'],
          ['offplan', 'initial', 'Off-plan · First sale', 'Under construction, sold by the developer.'],
          ['offplan', 'resale', 'Off-plan · Resale', 'Under construction, sold by a buyer before handover.'],
        ];
  const error = ed.errors.devStatus || ed.errors.txn;
  const chosen = (dev: string, txn: string) => (c.land || d.devStatus === dev) && (c.rent || d.txn === txn);
  // One widget answers two fields: combine their AI states (any suggestion or gap wins over "filled").
  const review = useContext(AiReviewContext);
  const parts = [...(c.land ? [] : ['designer-devStatus']), ...(c.rent ? [] : ['designer-txn'])];
  const states = parts.map((id) => (review?.suggestions?.[id] ? 'suggestion' : review?.states?.[id]));
  const aiState = (['suggestion', 'missing', 'edited', 'filled'] as const).find((s) => states.includes(s));
  return (
    <PlainField
      label={c.land ? 'Transaction' : c.rent ? 'Development status' : 'Development status & transaction'}
      aiState={aiState}
      className="mb-4"
    >
      <div
        id="designer-devStatus"
        role="radiogroup"
        aria-label="Market status"
        tabIndex={-1}
        className="grid gap-2 sm:grid-cols-2"
        {...invalidProps('designer-devStatus', error)}
      >
        {options.map(([dev, txn, label, help]) => (
          <button
            type="button"
            key={label}
            role="radio"
            aria-checked={chosen(dev, txn)}
            className="choice"
            onClick={() =>
              ed.set('editor.d', {
                ...d,
                ...(c.land ? {} : { devStatus: dev }),
                ...(c.rent ? {} : { txn }),
              })
            }
          >
            <span className="radio-dot" />
            <span>
              <span className="block text-[13px] font-semibold">{label}</span>
              <span className="mt-1 block text-xs text-muted">{help}</span>
            </span>
          </button>
        ))}
      </div>
      <span id="designer-txn" tabIndex={-1} />
      {error && (
        <p className="err mt-2" role="alert" id="designer-devStatus-err">
          {error}
        </p>
      )}
      {/* AI suggestions waiting for review (e.g. a different transaction type) */}
      {parts
        .filter((id) => review?.suggestions?.[id])
        .map((id) => (
          <Field key={id} id={id} className="mt-2">
            {null}
          </Field>
        ))}
    </PlainField>
  );
}

/* ---------- Building / project catalogue ---------- */
export function applyBuilding(ed, b) {
  ed.update((prev) => {
    const e = prev.editor;
    const d = { ...e.d };
    const filled: string[] = [];
    const projectKeys: string[] = [];
    const put = (key: string, value: unknown, list = filled) => {
      if (blank(value) || !blank(d[key])) return;
      d[key] = value;
      list.push(key);
    };
    Object.assign(d, {
      emirate: b.emirate,
      communityId: b.community,
      buildingName: b.name,
      buildingRef: b.key,
      proposing: false,
    });
    filled.push('emirate', 'communityId', 'buildingName');
    put('subcommunity', b.subcommunity);
    put('tower', b.tower);
    put('developer', b.developer || b.project?.developer);
    put('masterDeveloper', b.masterDeveloper);
    if (blank(d.lat) && blank(d.lng) && b.lat && b.lng) {
      d.lat = b.lat;
      d.lng = b.lng;
      filled.push('lat', 'lng');
    }
    if (d.devStatus !== 'offplan') put('completionYear', b.completionYear);
    if (b.tenure && (blank(d.tenure) || (d.tenure === 'freehold' && !e.sources?.tenure))) {
      d.tenure = b.tenure;
      filled.push('tenure');
    }
    put('totalFloors', b.totalFloors);
    put('cooling', b.cooling);
    put('pets', b.pets);
    if (b.serviceChargePerSqft && d.purpose !== 'rent' && blank(d.serviceCharge)) {
      d.serviceCharge = String(b.serviceChargePerSqft);
      d.serviceBasis = 'per_sqft';
      filled.push('serviceCharge', 'serviceBasis');
    }
    let milestones = e.milestones || [];
    const p = b.project;
    if (p && d.devStatus === 'offplan') {
      put('stage', p.stage, projectKeys);
      put('handoverQ', p.handoverQ, projectKeys);
      put('handoverY', p.handoverY, projectKeys);
      put('handoverDate', p.handoverDate, projectKeys);
      if (p.progressPct && blank(d.progressPct)) {
        put('progressPct', p.progressPct, projectKeys);
        put('progressSource', p.progressSource || 'Developer listing on Emirate08', projectKeys);
        put('progressDate', p.progressDate, projectKeys);
      }
      if (!milestones.length && p.milestones?.length && d.txn !== 'resale') {
        milestones = p.milestones.map((m, i) => ({ ...m, id: 'cat-ms-' + i }));
        projectKeys.push('milestones');
      }
    }
    const amen = { ...(e.amen || {}) };
    const status = d.devStatus === 'offplan' ? 'planned' : 'existing';
    for (const id of b.sharedAmenities || [])
      if (S.AMENITY[id] && !amen[id]) amen[id] = { selected: true, status, charge: 'included', inherited: true, reviewed: false };
    return {
      ...prev,
      editor: {
        ...e,
        d,
        amen,
        milestones,
        catalog: b,
        sources: withSources({ sources: withSources(e, filled, 'catalogue') }, projectKeys, 'project'),
      },
    };
  });
}

export function BuildingPicker({ ed }) {
  const d = ed.L.editor.d;
  const off = S.ctxOf(d).off;
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = d.buildingName || '';
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);
  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (U.trim1(q).length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q, emirate: d.emirate || '' });
        const response = await fetch('/api/listing-catalogue?' + params, { credentials: 'same-origin' });
        const json = response.ok ? await response.json() : { buildings: [] };
        setResults(Array.isArray(json.buildings) ? json.buildings : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };
  const catalog = ed.L.editor.catalog && ed.L.editor.catalog.key === d.buildingRef ? ed.L.editor.catalog : null;
  return (
    <div className="mb-4 space-y-3">
      <Field
        id="designer-buildingName"
        label="Building / Project"
        optional={off ? undefined : 'where applicable'}
        error={ed.errors.buildingName}
        hint="Pick from the list to fill the community, developer, map pin and building facts."
      >
        <div className="relative">
          <input
            id="designer-buildingName"
            className="input"
            value={query}
            maxLength={80}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls="building-results"
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => {
              ed.set('editor.d', { ...d, buildingName: e.target.value, buildingRef: '' });
              search(e.target.value);
            }}
            placeholder="Search a building or project, e.g. Marina Gate 1"
            {...invalidProps('designer-buildingName', ed.errors.buildingName)}
          />
          {open && results.length > 0 && (
            <ul
              id="building-results"
              role="listbox"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg"
            >
              {results.map((b) => (
                <li key={b.key} role="option" aria-selected={b.key === d.buildingRef}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-[13px] hover:bg-mist"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyBuilding(ed, b);
                      setOpen(false);
                    }}
                  >
                    <span className="block font-semibold">{b.name}</span>
                    <span className="block text-xs text-muted">
                      {[b.subcommunity, b.community, b.emirate].filter(Boolean).join(', ')}
                      {b.developer ? ' · ' + b.developer : ''}
                      {b.project ? ' · Off-plan project' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {loading && <p className="mt-1 text-xs text-muted">Searching buildings…</p>}
      </Field>
      {catalog && <BuildingInfo b={catalog} />}
      <label className="check">
        <input type="checkbox" checked={!!d.proposing} onChange={(e) => ed.set('editor.d.proposing', e.target.checked)} />
        <span>Can’t find your building? Propose a building / project</span>
      </label>
      {d.proposing && <p className="text-xs text-muted">Saved as a proposed building for review with this listing.</p>}
    </div>
  );
}

function BuildingInfo({ b }) {
  const rows = [
    ['Developer', b.developer || b.project?.developer],
    ['Master developer', b.masterDeveloper],
    ['Completion year', b.completionYear],
    ['Handover', b.project?.handoverQ && b.project?.handoverY ? 'Q' + b.project.handoverQ + ' ' + b.project.handoverY : ''],
    ['Total floors', b.totalFloors],
    ['Typical service charge', b.serviceChargePerSqft ? 'AED ' + b.serviceChargePerSqft + ' / sq ft / year' : ''],
    ['Shared amenities', (b.sharedAmenities || []).length ? b.sharedAmenities.length + ' imported for review' : ''],
  ].filter(([, v]) => v);
  return (
    <div className="rounded-lg bg-mist p-3 text-xs">
      <p className="font-semibold">
        <Icon name="building" className="mr-1" />
        Building information · from {b.listingCount} listing{b.listingCount === 1 ? '' : 's'} on Emirate08
      </p>
      <dl className="mt-2 grid gap-1 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-muted">Filled answers stay editable. Check them against the title deed or permit.</p>
    </div>
  );
}

/* ---------- Off-plan unit types from the project ---------- */
export function UnitTypePicker({ ed }) {
  const e = ed.L.editor,
    d = e.d,
    c = S.ctxOf(d);
  const types = (c.off && e.catalog?.key === d.buildingRef && e.catalog?.project?.unitTypes) || [];
  if (!types.length) return null;
  const label = (t) =>
    [
      t.bedrooms === 'studio' ? 'Studio' : t.bedrooms ? t.bedrooms + ' BR' : S.PTYPE_LABEL[t.ptype] || 'Unit',
      t.layoutCode,
      t.areaFrom ? U.fmtNum(t.areaFrom, 0) + (t.areaTo && t.areaTo > t.areaFrom ? '–' + U.fmtNum(t.areaTo, 0) : '') + ' sq ft' : '',
      t.priceFrom ? 'from AED ' + U.fmtNum(t.priceFrom, 0) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  const choose = (t) =>
    ed.update((prev) => {
      const pe = prev.editor;
      const nd = { ...pe.d };
      const keys: string[] = [];
      const put = (key, value) => {
        if (blank(value) || !blank(nd[key])) return;
        nd[key] = value;
        keys.push(key);
      };
      put('bedrooms', t.bedrooms);
      put('bathrooms', t.bathrooms);
      put('layoutCode', t.layoutCode);
      if (t.areaFrom && blank(nd.unitArea?.raw) && S.ctxOf(nd).unitLike) {
        nd.unitArea = { raw: String(t.areaFrom), unit: 'sqft', ...(t.areaTo > t.areaFrom ? { rawMax: String(t.areaTo) } : {}) };
        keys.push('unitArea');
      }
      if (S.ctxOf(nd).offInit) put('unitPrice', t.priceFrom ? String(t.priceFrom) : '');
      const plans = prev.media?.floorplans || [];
      const addPlan = t.floorPlan && !plans.some((p) => p.src === t.floorPlan);
      return {
        ...prev,
        editor: { ...pe, d: nd, sources: withSources(pe, keys, 'project') },
        media: addPlan
          ? {
              ...prev.media,
              floorplans: [
                ...plans,
                { src: t.floorPlan, name: t.layoutCode || label(t), mimetype: 'image/*', caption: 'Project floor plan', level: '' },
              ],
            }
          : prev.media,
      };
    });
  return (
    <div className="mb-4 rounded-lg border border-line p-3">
      <p className="text-[13px] font-semibold">Unit types in this project</p>
      <p className="mt-1 text-xs text-muted">Choose one to fill bedrooms, bathrooms, size, layout and the project floor plan.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {types.map((t, i) => (
          <button key={i} type="button" className="tog-chip" onClick={() => choose(t)}>
            {label(t)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Area unit (a preference, not a question) ---------- */
export function AreaUnitToggle({ ed }) {
  const d = ed.L.editor.d;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>Enter areas in</span>
      {[
        ['sqft', 'sq ft'],
        ['sqm', 'sq m'],
      ].map(([v, l]) => (
        <button
          key={v}
          type="button"
          className="tog-chip"
          aria-pressed={(d.areaUnit || 'sqft') === v}
          onClick={() => ed.set('editor.d.areaUnit', v)}
        >
          {l}
        </button>
      ))}
      <span>· Buyers see both units. Set your default in Account › Listing defaults.</span>
    </div>
  );
}

/* ---------- Translation ---------- */
export function TranslateWidget({ ed }) {
  const d = ed.L.editor.d;
  const [busy, setBusy] = useState(false);
  const { out: noCredits } = useAiCredits();
  return (
    <div className="mb-4">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={busy || noCredits || (blank(d.title) && blank(d.description))}
        onClick={async () => {
          if (
            (!blank(d.altTitle) || !blank(d.altDesc)) &&
            !(await ed.confirm({
              title: 'Replace the translated text?',
              body: 'The current translation will be replaced with a new AI translation of the English title and description.',
              ok: 'Translate',
              cancel: 'Keep my text',
            }))
          )
            return;
          setBusy(true);
          try {
            const response = await fetch('/api/listing-translate', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ title: d.title, description: d.description, language: d.altLang || 'ar' }),
            });
            const json = await readAiResponse(response);
            if (!response.ok) throw new Error(json.error || 'The text could not be translated.');
            ed.update((prev) => ({
              ...prev,
              editor: {
                ...prev.editor,
                d: { ...prev.editor.d, altLang: prev.editor.d.altLang || 'ar', altTitle: json.title || '', altDesc: json.description || '' },
                sources: withSources(prev.editor, ['altTitle', 'altDesc'], 'ai'),
              },
            }));
            ed.toast('Translation added. Review it before publishing.');
          } catch (error) {
            ed.toast(error instanceof Error ? error.message : 'The text could not be translated.', { icon: 'exclamation-circle' });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="translate" />
        {busy ? 'Translating…' : 'Translate title & description with AI'}
      </button>
      <AiCreditsBadge />
    </div>
  );
}

/* ---------- Source chip for the review step ---------- */
export function SourceChip({ source }) {
  if (!source || !SOURCE_LABEL[source]) return null;
  return (
    <span className="ml-1 rounded bg-sage-soft px-1.5 py-0.5 text-2xs font-semibold text-sage-ink">{SOURCE_LABEL[source]}</span>
  );
}
