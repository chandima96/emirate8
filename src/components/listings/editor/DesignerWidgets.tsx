'use client';

import { useContext, useState } from 'react';
import { AiField as Field, AiReviewContext, AiStatus } from '@/components/ui/AiAssist';
import { invalidProps } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { COMMUNITIES, EMIRATES } from '@/config/reference';
import { currentUser } from '@/lib/store';
import { uid } from '@/lib/utils';
import { listingSchema as S } from './designer-schema';
import { editorState } from './designer-model';
import { BuildingPicker } from './AutofillWidgets';
import { SeoAssistant } from './SeoAssistant';

const U = S.util;
export function coordinatesFromMapLink(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const valid = (lat, lng) => {
    const latitude = Number(lat), longitude = Number(lng);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      ? { lat: String(latitude), lng: String(longitude) }
      : null;
  };
  let match = text.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/)
    || text.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/)
    || text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (match) return valid(match[1], match[2]);
  try {
    const url = new URL(text);
    for (const key of ['q', 'query', 'll', 'center']) {
      const coords = url.searchParams.get(key)?.match(/(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/);
      if (coords) return valid(coords[1], coords[2]);
    }
  } catch { /* User may still be pasting a partially entered link. */ }
  return null;
}
function isGoogleMapLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'].includes(url.hostname.toLowerCase()) ||
      (url.protocol === 'https:' && url.hostname.toLowerCase().endsWith('.google.com'));
  } catch { return false; }
}

export function WidgetError({ ed, name }) {
  return ed.errors[name] ? (
    <p className="err mt-2" role="alert" id={'designer-' + name + '-err'}>
      {ed.errors[name]}
    </p>
  ) : null;
}

export function LocationWidget({ ed, kind }) {
  const d = ed.L.editor.d,
    set = (key, value) => ed.set('editor.d.' + key, value);
  if (kind === 'community')
    return (
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field id="designer-emirate" label="Emirate" error={ed.errors.emirate} value={d.emirate}>
          <select
            id="designer-emirate"
            className="select"
            value={d.emirate || ''}
            onChange={(e) => {
              ed.set('editor.d', {
                ...d,
                emirate: e.target.value,
                communityId: '',
                subcommunity: '',
                buildingName: '',
                tower: '',
                developer: '',
                lat: '',
                lng: '',
              });
            }}
          >
            <option value="">Select emirate</option>
            {EMIRATES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field id="designer-community" label="Area / Community" error={ed.errors.community} value={d.communityId}>
          <input
            id="designer-community"
            className="input"
            list="listing-communities"
            value={d.communityId || ''}
            placeholder="Search or enter community"
            onChange={(e) =>
              ed.set('editor.d', {
                ...d,
                communityId: e.target.value,
                subcommunity: '',
                buildingName: '',
                tower: '',
                developer: '',
                lat: '',
                lng: '',
              })
            }
            {...invalidProps('designer-community', ed.errors.community)}
          />
          <datalist id="listing-communities">
            {(d.emirate ? COMMUNITIES[d.emirate] || [] : [...new Set(Object.values(COMMUNITIES).flat())]).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
        <Field id="designer-subcommunity" label="Subcommunity" optional="where applicable" value={d.subcommunity}>
          <input
            id="designer-subcommunity"
            className="input"
            maxLength={120}
            value={d.subcommunity || ''}
            onChange={(e) => set('subcommunity', e.target.value)}
          />
        </Field>
      </div>
    );
  if (kind === 'building') return <BuildingPicker ed={ed} />;
  if (kind === 'map')
    return <div className="mb-4 space-y-2">
      <Field id="designer-mapLocation" label="Google Maps location" optional="optional" value={d.mapLocation}>
        <input
          id="designer-mapLocation"
          className="input"
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="Paste a Google Maps share link"
          value={d.mapLocation || ''}
          onChange={(event) => {
            const mapLocation = event.target.value;
            const coordinates = coordinatesFromMapLink(mapLocation);
            ed.set('editor.d', { ...d, mapLocation, lat: coordinates?.lat || '', lng: coordinates?.lng || '' });
          }}
        />
      </Field>
      <p className="text-xs text-muted">
        Paste a Google Maps link with a dropped pin, or enter the coordinates below. Picking a building from the list
        fills the building’s pin automatically.
      </p>
      {d.lat && d.lng && <p className="text-xs text-sage-ink"><Icon name="geo-alt" className="mr-1" />Map pin added</p>}
      {d.mapLocation && <a className="inline-flex items-center gap-1 text-xs font-medium text-[#3157a5] underline underline-offset-2" href={isGoogleMapLink(d.mapLocation) ? d.mapLocation : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.mapLocation)}`} target="_blank" rel="noreferrer"><Icon name="box-arrow-up-right" />Open location in Google Maps</a>}
    </div>;
  return null;
}

export function AmenitiesWidget({ ed }) {
  const [query, setQuery] = useState('');
  const aiReview = useContext(AiReviewContext);
  const amen = ed.L.editor.amen || {},
    off = S.ctxOf(ed.L.editor.d).off;
  const change = (id, next) => ed.set('editor.amen', { ...amen, [id]: { ...next, reviewed: true } });
  const imported = Object.keys(amen).filter((id) => amen[id].inherited && !amen[id].reviewed);
  return (
    <div id="designer-amen" tabIndex={-1} className="mb-5">
      <div className="mb-3">
        <AiStatus id="designer-amen" value={Object.values(amen).some((a: any) => a.selected !== false)} optional />
      </div>
      {imported.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sage-soft/50 p-3 text-xs">
          <span>
            {imported.length} shared amenit{imported.length === 1 ? 'y was' : 'ies were'} imported from the building.
            Untick any that don’t apply, then confirm.
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              ed.set(
                'editor.amen',
                Object.fromEntries(Object.entries(amen).map(([id, a]: [string, any]) => [id, a.inherited ? { ...a, reviewed: true } : a])),
              )
            }
          >
            Confirm imported amenities
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {Object.values(amen).filter((a: any) => a.selected !== false).length} selected
        </span>
        <label className="sr-only" htmlFor="amenity-search">
          Search amenities
        </label>
        <input
          id="amenity-search"
          className="input max-w-[280px]"
          type="search"
          placeholder="Search amenities"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {S.AMENITY_GROUPS.map((g) => {
          const items = g.items.filter(([, label]) => (label + ' ' + g.l).toLowerCase().includes(query.toLowerCase()));
          if (!items.length) return null;
          return (
            <fieldset key={g.id}>
              <legend className="label">
                {g.l} <span className="text-xs font-normal text-muted">· {g.scope}</span>
              </legend>
              <div className="space-y-2">
                {items.map(([id, label]) => (
                  <div key={id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!!amen[id] && amen[id].selected !== false}
                        onChange={(e) =>
                          change(id, {
                            ...(amen[id] || {}),
                            selected: e.target.checked,
                            status: amen[id]?.status || (off ? 'planned' : 'existing'),
                            charge: amen[id]?.charge || 'included',
                          })
                        }
                      />
                      <span>{label}</span>
                      {amen[id]?.inherited && !amen[id]?.reviewed && (
                        <span className="rounded bg-sage-soft px-1.5 py-0.5 text-[10px] font-semibold text-sage-ink">From building</span>
                      )}
                      {aiReview?.states?.['amenity-' + id] === 'filled' && <span className="rounded bg-[#ecebff] px-1.5 py-0.5 text-[10px] font-semibold text-[#4338a8]">AI-filled</span>}
                    </label>
                    {amen[id]?.selected && (
                      <div className="mt-1 flex flex-wrap gap-2 pl-6">
                        {off && (
                          <select
                            className="select h-8 w-auto text-xs"
                            aria-label={label + ' status'}
                            value={amen[id].status}
                            onChange={(e) => change(id, { ...amen[id], status: e.target.value })}
                          >
                            <option value="existing">Existing</option>
                            <option value="planned">Planned</option>
                          </select>
                        )}
                        {g.charge && (
                          <select
                            className="select h-8 w-auto text-xs"
                            aria-label={label + ' charge'}
                            value={amen[id].charge}
                            onChange={(e) => change(id, { ...amen[id], charge: e.target.value })}
                          >
                            <option value="included">Included</option>
                            <option value="extra">Extra charge</option>
                            <option value="unknown">Charge unknown</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <WidgetError ed={ed} name="amen" />
    </div>
  );
}

export function AdditionalFeatures({ ed }) {
  const rows = ed.L.editor.custom || [];
  const change = (id, key, value) =>
    ed.set(
      'editor.custom',
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  const [removed, setRemoved] = useState<any>(null);
  const set = (next) => ed.set('editor.custom', next);
  return (
    <div id="designer-custom" tabIndex={-1} className="space-y-3">
      <p className="text-xs text-muted">
        Additional features appear separately and are subject to platform review. Choose existing amenities above when
        available.
      </p>
      {rows.map((row, i) => (
        <div key={row.id} className="rounded-lg border border-line p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={'feature-name-' + row.id} label="Feature name" value={row.name}>
              <input
                id={'feature-name-' + row.id}
                className="input"
                maxLength={60}
                value={row.name}
                onChange={(e) => set(rows.map((r, j) => (i === j ? { ...r, name: e.target.value.trimStart() } : r)))}
              />
            </Field>
            <Field id={'feature-desc-' + row.id} label="Description" optional="optional" value={row.desc}>
              <input
                id={'feature-desc-' + row.id}
                className="input"
                maxLength={160}
                value={row.desc || ''}
                onChange={(e) => set(rows.map((r, j) => (i === j ? { ...r, desc: e.target.value } : r)))}
              />
            </Field>
            {[
              [
                'cat',
                'Category',
                [
                  ['inside', 'Inside property'],
                  ['private_outdoor', 'Private outdoor'],
                  ['shared', 'Shared facility'],
                  ['service', 'Building service'],
                  ['access', 'Accessibility'],
                  ['other', 'Other'],
                ],
              ],
              [
                'scope',
                'Private / Shared',
                [
                  ['private', 'Private'],
                  ['shared', 'Shared'],
                ],
              ],
              ...(S.ctxOf(ed.L.editor.d).off
                ? [
                    [
                      'status',
                      'Existing / Planned',
                      [
                        ['existing', 'Existing'],
                        ['planned', 'Planned'],
                      ],
                    ],
                  ]
                : []),
              [
                'charge',
                'Charge',
                [
                  ['included', 'Included'],
                  ['extra', 'Additional charge'],
                ],
              ],
            ].map(([key, label, options]) => (
              <Field key={String(key)} id={'feature-' + key + row.id} label={label as string} optional="optional" value={row[String(key)]}>
                <select
                  id={'feature-' + key + row.id}
                  className="select"
                  value={row[String(key)] || ''}
                  onChange={(e) => change(row.id, key, e.target.value)}
                >
                  <option value="">Select</option>
                  {(options as string[][]).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          {S.customErrors(editorState(ed.L))[row.id] && (
            <p className="err">{S.customErrors(editorState(ed.L))[row.id]}</p>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2 text-danger"
            onClick={() => {
              setRemoved(row);
              set(rows.filter((r) => r.id !== row.id));
            }}
          >
            Remove feature
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => set([...rows, { id: uid('feature'), name: '', desc: '' }])}
      >
        <Icon name="plus" />
        Add feature
      </button>
      {removed && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            set([...rows, removed]);
            setRemoved(null);
          }}
        >
          Undo removal
        </button>
      )}
      <WidgetError ed={ed} name="custom" />
    </div>
  );
}

export function MilestonesWidget({ ed }) {
  const rows = ed.L.editor.milestones || [];
  const set = (next) => ed.set('editor.milestones', next);
  const change = (id, key, value) => set(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const check = S.pricing.schedule(editorState(ed.L));
  const errors = S.milestoneErrors(editorState(ed.L));
  return (
    <div id="designer-milestones" tabIndex={-1} className="space-y-3">
      <AiStatus id="designer-milestones" value={rows.length > 0} />
      <p className="text-xs text-muted">
        Enter each milestone in AED or as a percentage. Booking is counted once according to the option above.
      </p>
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={'ms-name-' + r.id} label="Milestone name" value={r.name}>
              <input
                id={'ms-name-' + r.id}
                className="input"
                value={r.name || ''}
                onChange={(e) => change(r.id, 'name', e.target.value)}
              />
            </Field>
            <Field id={'ms-mode-' + r.id} label="Amount basis" value={r.mode}>
              <select
                id={'ms-mode-' + r.id}
                className="select"
                value={r.mode}
                onChange={(e) => change(r.id, 'mode', e.target.value)}
              >
                <option value="pct">Percentage of unit price</option>
                <option value="aed">AED amount</option>
              </select>
            </Field>
            <Field id={'ms-value-' + r.id} label={r.mode === 'pct' ? 'Percentage (%)' : 'Amount (AED)'} value={r.value}>
              <input
                id={'ms-value-' + r.id}
                className="input"
                inputMode="decimal"
                value={r.value || ''}
                onChange={(e) => change(r.id, 'value', e.target.value)}
              />
            </Field>
            <Field id={'ms-trigger-' + r.id} label="When due" value={r.trigger}>
              <select
                id={'ms-trigger-' + r.id}
                className="select"
                value={r.trigger || ''}
                onChange={(e) => change(r.id, 'trigger', e.target.value)}
              >
                <option value="">Select trigger</option>
                <option value="booking">On booking</option>
                <option value="date">On a date</option>
                <option value="construction">Construction milestone</option>
                <option value="handover">On handover</option>
                <option value="post">Post-handover</option>
              </select>
            </Field>
            {['date', 'construction', 'post'].includes(r.trigger) && (
              <Field id={'ms-when-' + r.id} label={r.trigger === 'date' ? 'Due date' : 'Due details'} value={r.when}>
                <input
                  id={'ms-when-' + r.id}
                  className="input"
                  type={r.trigger === 'date' ? 'date' : 'text'}
                  value={r.when || ''}
                  onChange={(e) => change(r.id, 'when', e.target.value)}
                />
              </Field>
            )}
          </div>
          {errors[r.id] && <p className="err mt-2">{errors[r.id]}</p>}
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2 text-danger"
            onClick={() => set(rows.filter((x) => x.id !== r.id))}
          >
            Remove milestone
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => set([...rows, { id: uid('ms'), name: '', mode: 'pct', value: '', trigger: '', when: '' }])}
      >
        <Icon name="plus" />
        Add milestone
      </button>
      <p className={'rounded-lg p-3 text-xs ' + (check.ok ? 'bg-ok-soft text-ok' : 'bg-mist text-muted')}>
        {check.msg}
      </p>
      <WidgetError ed={ed} name="milestones" />
    </div>
  );
}

export function TermsWidget({ ed, kind }) {
  const st = editorState(ed.L),
    d = st.d;
  if (kind === 'cheques')
    return (
      <div id="designer-cheques" tabIndex={-1} className="grid gap-3 sm:grid-cols-2">
        {(d.cheques || []).map((n) => (
          <Field
            key={n}
            id={'cheque-price-' + n}
            label={'Annual rent with ' + n + (n === '1' ? ' cheque' : ' cheques')}
            optional="defaults to annual rent"
            value={st.cheqAmts?.[n] || ''}
          >
            <input
              id={'cheque-price-' + n}
              className="input"
              inputMode="decimal"
              value={st.cheqAmts?.[n] || ''}
              placeholder={d.annualRent || 'AED'}
              onChange={(e) => ed.set('editor.cheqAmts', { ...st.cheqAmts, [n]: e.target.value })}
            />
          </Field>
        ))}
        <WidgetError ed={ed} name="cheques" />
      </div>
    );
  const rows = st.extraTerms || [];
  const change = (id, key, value) =>
    ed.set(
      'editor.extraTerms',
      rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  return (
    <div id="designer-extra" tabIndex={-1} className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border border-line p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['label', 'Term / charge'],
              ['amount', 'Amount (AED)'],
              ['freq', 'Frequency'],
              ['payer', 'Paid by'],
              ['notes', 'Notes'],
            ].map(([key, label]) => (
              <Field
                key={key}
                id={'term-' + r.id + key}
                label={label}
                optional={key === 'label' ? undefined : 'optional'}
                value={r[key] || ''}
              >
                <input
                  id={'term-' + r.id + key}
                  className="input"
                  value={r[key] || ''}
                  maxLength={key === 'notes' ? 500 : 160}
                  onChange={(e) => change(r.id, key, e.target.value)}
                />
              </Field>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2 text-danger"
            onClick={() =>
              ed.set(
                'editor.extraTerms',
                rows.filter((x) => x.id !== r.id),
              )
            }
          >
            Remove term
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() =>
          ed.set('editor.extraTerms', [
            ...rows,
            { id: uid('term'), label: '', amount: '', freq: '', payer: '', notes: '' },
          ])
        }
      >
        Add additional term
      </button>
      <WidgetError ed={ed} name="extra" />
    </div>
  );
}

export function PriceSummary({ ed, kind }) {
  const st = editorState(ed.L);
  let lines = [],
    note = '',
    warnings = [];
  if (kind === 'saleSummary') {
    const p = S.pricing.sale(st);
    lines = [
      ['Asking price', U.fmtAED(p.price)],
      ['Price per ' + (p.unit === 'sqm' ? 'sq m' : 'sq ft'), U.fmtAED(p.ppa)],
      ['Annual service charge', U.fmtAED(p.serviceAnnual)],
    ];
    note = p.basisLabel
      ? 'Price per area uses ' + p.basisLabel.toLowerCase() + ' only. Plot and balcony areas are kept separate.'
      : '';
  } else if (kind === 'rentSummary') {
    const p = S.pricing.rent(st);
    lines = [
      ['Recurring annual rent', U.fmtAED(p.rent)],
      ...p.payLines.map((x) => [x.k, x.v]),
      ['Refundable deposit', p.deposit || 'Not stated'],
      ...p.oneTime.map((x) => [x.k + ' · one-time', x.v]),
      ...p.other.map((x) => [x.k, x.v]),
    ];
  } else {
    const p = S.pricing.resale(st);
    lines = [
      ['Payable to seller now', U.fmtAED(p.payNow)],
      ['Future developer balance', U.fmtAED(p.future)],
      ['Stated total price', U.fmtAED(p.total)],
    ];
    note = p.totalNote;
    warnings = p.warnings;
  }
  return (
    <div className="rounded-lg bg-mist p-4">
      <dl className="space-y-2">
        {lines.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-3 text-[13px]">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
      {warnings.map((w) => (
        <p key={w} className="mt-2 text-xs text-warn">
          {w}
        </p>
      ))}
    </div>
  );
}

const PARA = '\n\n';
const optLabel = (key, value) => S.FIELDS[key]?.opts?.find?.((o) => o.v === value)?.l || '';

/** Factual title and description drafted only from the structured answers. */
export function draftCopy(l) {
  const d = l.editor.d,
    c = S.ctxOf(d);
  const type = S.PTYPE_LABEL[d.ptype] || 'Property';
  const beds = c.resUnit ? (d.bedrooms === 'studio' ? 'Studio' : l.beds ? l.beds + ' BR' : '') : '';
  const view = (d.views || []).filter((v) => v !== 'other').map((v) => optLabel('views', v))[0];
  const place = d.buildingName || d.subcommunity || d.communityId;
  const title = [
    [c.ready && d.occupancy === 'vacant' ? 'Vacant' : '', beds, beds === 'Studio' ? '' : type].filter(Boolean).join(' '),
    view ? view + ' view' : '',
    ['high', 'penthouse'].includes(d.floorBand) ? optLabel('floorBand', d.floorBand) : '',
    c.off ? 'Off-plan' : '',
    place,
  ]
    .filter(Boolean)
    .join(' · ');
  const sizeText = l.size ? U.fmtNum(l.size, 0) + ' sq ft (' + U.fmtNum(l.sizeSqm || 0, 0) + ' sq m)' : '';
  const amenities = (l.amenities || []).slice(0, 8);
  const facts = [
    [
      (beds ? beds.replace(' BR', '-bedroom') + ' ' : '') + type.toLowerCase(),
      d.purpose === 'rent' ? 'for rent' : 'for sale',
      place ? 'in ' + [d.buildingName, d.subcommunity, d.communityId].filter(Boolean).join(', ') : '',
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/^./, (m) => m.toUpperCase()) + '.',
    [sizeText && 'Size: ' + sizeText, l.baths ? l.baths + ' bathroom' + (l.baths === 1 ? '' : 's') : '', l.parking ? l.parking + ' parking space' + (l.parking === 1 ? '' : 's') : '']
      .filter(Boolean)
      .join(' · '),
    [optLabel('furnishing', d.furnishing), optLabel('condition', d.condition), c.ready ? optLabel('occupancy', d.occupancy) : '']
      .filter(Boolean)
      .join(', '),
    view ? (d.views || []).map((v) => optLabel('views', v)).filter(Boolean).join(', ') + ' views.' : '',
    d.developer ? 'Developed by ' + d.developer + (c.ready && d.completionYear ? ', completed in ' + d.completionYear : '') + '.' : '',
    c.off && d.handoverQ && d.handoverY ? 'Expected handover: Q' + d.handoverQ + ' ' + d.handoverY + '.' : '',
    l.postHandover ? 'Post-handover payment plan available.' : '',
    d.tenure ? optLabel('tenure', d.tenure) + ' ownership.' : '',
    amenities.length ? 'Amenities: ' + amenities.join(', ') + '.' : '',
    ...(l.highlights || []),
  ];
  return { title: title.slice(0, 100), description: facts.filter((x) => x && x !== '.').join(PARA) };
}

/** Highlight chips suggested from the answers (the user adds the ones that apply). */
function suggestedHighlights(l) {
  const d = l.editor.d,
    c = S.ctxOf(d);
  const out = [
    c.ready && d.occupancy === 'vacant' ? 'Vacant and ready to move in' : '',
    ...(d.views || []).filter((v) => v !== 'other').map((v) => optLabel('views', v) + ' view'),
    ['high', 'penthouse'].includes(d.floorBand) ? optLabel('floorBand', d.floorBand) : '',
    d.condition === 'renovated' ? 'Renovated' : d.condition === 'brand_new' ? 'Brand new' : '',
    d.position === 'corner' ? 'Corner unit' : '',
    (d.extraRooms || []).includes('maid') ? 'Maid’s room' : '',
    l.editor.amen?.priv_pool?.selected ? 'Private pool' : '',
    d.furnishing === 'furnished' ? 'Fully furnished' : '',
    l.postHandover ? 'Post-handover payment plan' : '',
    c.rent && (d.cheques || []).length > 2 ? 'Up to ' + Math.max(...d.cheques.map(Number)) + ' cheques' : '',
  ].filter(Boolean);
  const have = new Set((l.highlights || []).map((h) => U.norm(h)));
  return [...new Set(out)].filter((h) => !have.has(U.norm(h)));
}

export function MarketingWidget({ ed, kind }) {
  const [text, setText] = useState('');
  const l = ed.L,
    d = l.editor.d;
  if (kind === 'generate')
    return (
      <div className="mb-4">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={async () => {
            if (
              (d.title || d.description) &&
              !(await ed.confirm({
                title: 'Replace marketing copy?',
                body: 'Generate a factual starting point from the entered property details. Review and edit it before publishing.',
                ok: 'Generate copy',
                cancel: 'Keep my copy',
              }))
            )
              return;
            const { title, description } = draftCopy(l);
            ed.set('editor.d', { ...d, title: title.slice(0, 100), description });
          }}
        >
          <Icon name="magic" />
          Generate from property details
        </button>
        <p className="mt-2 text-xs text-muted">
          Drafts a factual title and description from the details you entered, including building facts. Edit it before
          publishing.
        </p>
        <SeoAssistant ed={ed} />
      </div>
    );
  const rows = l.highlights || [];
  return (
    <div id="designer-highlights" tabIndex={-1}>
      <div className="mb-2">
        <AiStatus id="designer-highlights" value={rows.length > 0} optional />
      </div>
      <p className="mb-3 text-xs text-muted">Up to 6 factual highlights · 120 characters each · {rows.length} / 6</p>
      <div className="flex flex-wrap gap-2">
        {rows.map((h, i) => (
          <button
            type="button"
            className="tog-chip"
            aria-pressed="true"
            key={h}
            onClick={() =>
              ed.set(
                'highlights',
                rows.filter((_, j) => i !== j),
              )
            }
            aria-label={'Remove highlight: ' + h}
          >
            {h}
            <Icon name="x" />
          </button>
        ))}
      </div>
      {rows.length < 6 && suggestedHighlights(l).length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Suggested:</span>
          {suggestedHighlights(l)
            .slice(0, 6 - rows.length)
            .map((h) => (
              <button key={h} type="button" className="tog-chip" onClick={() => ed.set('highlights', [...rows, h])}>
                <Icon name="plus" />
                {h}
              </button>
            ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="highlight-new">
          New highlight
        </label>
        <input
          id="highlight-new"
          className="input"
          maxLength={120}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Corner unit with park views"
        />
        <button
          type="button"
          className="btn btn-outline"
          disabled={rows.length >= 6 || !text.trim()}
          onClick={() => {
            const value = U.trim1(text);
            if (U.CONTACT_RE.test(value)) {
              ed.toast('Remove contact details and links from highlights.');
              return;
            }
            if (!rows.some((h) => U.norm(h) === U.norm(value))) ed.set('highlights', [...rows, value]);
            setText('');
          }}
        >
          Add
        </button>
      </div>
      <WidgetError ed={ed} name="highlights" />
    </div>
  );
}

/** Reference documents deliberately remain session-only until private storage is available. */
export function PrivateDocument({ name, ed }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  return (
    <div>
      <label className="btn btn-outline btn-sm cursor-pointer" htmlFor={'private-doc-' + name}>
        <Icon name="file-earmark-lock" />
        Choose private document
      </label>
      <input
        id={'private-doc-' + name}
        className="sr-only"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = '';
          if (!selected) return;
          if (!['application/pdf', 'image/jpeg', 'image/png'].includes(selected.type) || selected.size > 10 * 1048576) {
            setError('Choose a PDF, JPG or PNG under 10 MB.');
            return;
          }
          setError('');
          setFile(selected);
        }}
      />
      {file && (
        <p className="mt-2 text-xs">
          {file.name} · {U.fmtBytes(file.size)}{' '}
          <button type="button" className="text-danger underline" onClick={() => setFile(null)}>
            Remove
          </button>
        </p>
      )}
      {error && <p className="err">{error}</p>}
      <p className="mt-2 text-xs text-muted">
        Private · session only. This file is excluded from drafts, previews and submission; secure document storage is
        not connected.
      </p>
    </div>
  );
}

export function Representation({ ed }) {
  const l = ed.L;
  if (!ed.isDeveloper) return null;
  return (
    <div className="mb-6 rounded-lg border border-line bg-mist p-4">
      <h3 className="h4">Developer representation</h3>
      <p className="mt-1 text-xs text-muted">Choose who represents this property in search.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          [
            true,
            'Public developer inventory',
            'Show the developer as owner and allow approved brokers to request a claim.',
          ],
          [false, 'Assign a primary broker', 'The selected broker becomes the main contact.'],
        ].map(([direct, label, help]) => (
          <button
            type="button"
            className="choice"
            key={String(direct)}
            role="radio"
            aria-checked={l.ownerDirect === direct}
            onClick={() =>
              ed.update((prev) => ({
                ...prev,
                ownerType: 'developer',
                ownerDirect: direct,
                claimable: direct,
                primaryBroker: direct ? '' : prev.primaryBroker,
              }))
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
      {!l.ownerDirect && (
        <Field id="f-primary-broker" label="Primary broker" error={ed.errors.primaryBroker} value={l.primaryBroker || ''}>
          <select
            id="f-primary-broker"
            className="select"
            value={l.primaryBroker || ''}
            onChange={(e) => ed.set('primaryBroker', e.target.value)}
            {...invalidProps('f-primary-broker', ed.errors.primaryBroker)}
          >
            <option value="">Select a current broker</option>
            {ed.developerBrokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {!ed.developerBrokers.length && (
            <p className="mt-2 text-xs text-muted">No verified brokers are available yet.</p>
          )}
        </Field>
      )}
    </div>
  );
}

export function ProfileWidget({ ed, kind }) {
  const u = currentUser() || {},
    profile = u.profile || u;
  const credentials = u.credentials || {};
  const agency = u.portfolio?.agency || profile.agency || {};
  const assigned = ed.isAgency ? (ed.agencyBrokers || []).find((b) => String(b.id) === String(ed.L.primaryBroker)) : null;
  const authority = S.permitAuthority(ed.L.editor.d.emirate || 'Dubai');
  if (kind === 'broker')
    return (
      <div className="mb-4 rounded-lg bg-mist p-4 text-[13px]">
        <p className="font-semibold">{profile.name || u.name || 'Your account profile'}</p>
        <dl className="mt-3 space-y-1">
          {(ed.isDeveloper
            ? [
                [
                  'Developer registration',
                  credentials.registrationNumber ||
                    credentials.developerNumber ||
                    profile.developer?.registrationNumber,
                ],
              ]
            : ed.isAgency
              ? [
                  ['Assigned broker', assigned?.name],
                  ['Broker BRN', assigned?.brn],
                  ['Agency ORN', credentials.orn || agency.orn],
                  ['Trade licence', credentials.tradeLicence],
                  ['Brokerage', u.name],
                ]
              : [
                ['BRN', credentials.brn],
                ['ORN', credentials.orn || agency.orn],
                [
                  'Brokerage',
                  agency.name || credentials.agencyName || (u.type === 'independent' ? 'Independent broker' : ''),
                ],
              ]
          )
            .concat([['Permit authority', authority.name]])
            .map(([label, value]) => (
            <div key={label} className="flex flex-wrap justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd>{value || 'Not provided'}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1 text-muted">
          {ed.isDeveloper ? 'Developer credentials' : 'Broker licence and brokerage'} are managed in your account.
          Verification status: {u.credentialStatus || 'not verified'}.
        </p>
      </div>
    );
  if (kind === 'contact')
    return (
      <div className="mb-4 rounded-lg bg-mist p-4 text-[13px]">
        <p className="font-semibold">{assigned ? 'Contact of the assigned broker' : 'Contact from your account'}</p>
        <p className="mt-1 text-muted">
          {(assigned
            ? [assigned.phone, assigned.whatsapp, assigned.publicEmail || assigned.email]
            : [u.portfolio?.publicPhone || profile.phone, u.portfolio?.whatsapp || profile.whatsapp, u.portfolio?.publicEmail || u.email]
          )
            .filter(Boolean)
            .join(' · ') || 'Manage your contact details in Account.'}
        </p>
        <p className="mt-1 text-xs text-muted">Listing-specific contact overrides are unverified.</p>
      </div>
    );
  return (
    <p className="mb-4 text-xs text-muted">
      Public location: {ed.L.editor.d.locPrecision === 'approximate' ? 'Community only' : 'Building / Project'}.
      Promotion does not add a verification badge.
    </p>
  );
}
