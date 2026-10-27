'use client';

import { focusListingField } from './EditorSection';
import { useState } from 'react';
import { Field, invalidProps } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { AREAS, EMIRATES } from '@/config/reference';
import { currentUser } from '@/lib/store';
import { uid } from '@/lib/utils';
import { listingSchema as S } from './designer-schema';
import { editorState, validateEditorStep } from './designer-model';

const U = S.util;
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
        <Field id="designer-emirate" label="Emirate" error={ed.errors.emirate}>
          <select
            id="designer-emirate"
            className="select"
            value={d.emirate || 'Dubai'}
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
        <Field id="designer-community" label="Area / Community" error={ed.errors.community}>
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
            {(AREAS[d.emirate || 'Dubai'] || []).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
        <Field id="designer-subcommunity" label="Subcommunity" optional="where applicable">
          <input
            id="designer-subcommunity"
            className="input"
            value={d.subcommunity || ''}
            onChange={(e) => set('subcommunity', e.target.value)}
          />
        </Field>
      </div>
    );
  if (kind === 'building')
    return (
      <div className="mb-4 space-y-3">
        <Field
          id="designer-buildingName"
          label="Building / Project"
          optional={S.ctxOf(d).off ? undefined : 'where applicable'}
          error={ed.errors.buildingName}
        >
          <input
            id="designer-buildingName"
            className="input"
            value={d.buildingName || ''}
            maxLength={80}
            onChange={(e) => set('buildingName', e.target.value)}
            placeholder="Enter the building or project name"
            {...invalidProps('designer-buildingName', ed.errors.buildingName)}
          />
        </Field>
        <label className="check">
          <input type="checkbox" checked={!!d.proposing} onChange={(e) => set('proposing', e.target.checked)} />
          <span>Can't find your building? Propose a building / project</span>
        </label>
        {d.proposing && (
          <p className="text-xs text-muted">Saved as a proposed building for review with this listing.</p>
        )}
      </div>
    );
  if (kind === 'map')
    return (
      <p className="mb-4 text-xs text-muted">
        Enter coordinates to locate the property.{' '}
        {U.parseDec(d.lat) != null &&
          U.parseDec(d.lng) != null &&
          U.parseDec(d.lat) >= -90 &&
          U.parseDec(d.lat) <= 90 &&
          U.parseDec(d.lng) >= -180 &&
          U.parseDec(d.lng) <= 180 && (
            <a
              className="underline"
              target="_blank"
              rel="noreferrer"
              href={
                'https://www.openstreetmap.org/?mlat=' +
                encodeURIComponent(d.lat) +
                '&mlon=' +
                encodeURIComponent(d.lng) +
                '#map=17/' +
                encodeURIComponent(d.lat) +
                '/' +
                encodeURIComponent(d.lng)
              }
            >
              Check this location on OpenStreetMap
            </a>
          )}
      </p>
    );
  return null;
}

export function AmenitiesWidget({ ed }) {
  const [query, setQuery] = useState('');
  const amen = ed.L.editor.amen || {},
    off = S.ctxOf(ed.L.editor.d).off;
  const change = (id, next) => ed.set('editor.amen', { ...amen, [id]: next });
  return (
    <div id="designer-amen" tabIndex={-1} className="mb-5">
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
            <Field id={'feature-name-' + row.id} label="Feature name">
              <input
                id={'feature-name-' + row.id}
                className="input"
                maxLength={60}
                value={row.name}
                onChange={(e) => set(rows.map((r, j) => (i === j ? { ...r, name: e.target.value.trimStart() } : r)))}
              />
            </Field>
            <Field id={'feature-desc-' + row.id} label="Description" optional="optional">
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
              <Field key={String(key)} id={'feature-' + key + row.id} label={label as string} optional="optional">
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
      <p className="text-xs text-muted">
        Enter each milestone in AED or as a percentage. Booking is counted once according to the option above.
      </p>
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={'ms-name-' + r.id} label="Milestone name">
              <input
                id={'ms-name-' + r.id}
                className="input"
                value={r.name || ''}
                onChange={(e) => change(r.id, 'name', e.target.value)}
              />
            </Field>
            <Field id={'ms-mode-' + r.id} label="Amount basis">
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
            <Field id={'ms-value-' + r.id} label={r.mode === 'pct' ? 'Percentage (%)' : 'Amount (AED)'}>
              <input
                id={'ms-value-' + r.id}
                className="input"
                inputMode="decimal"
                value={r.value || ''}
                onChange={(e) => change(r.id, 'value', e.target.value)}
              />
            </Field>
            <Field id={'ms-trigger-' + r.id} label="When due">
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
              <Field id={'ms-when-' + r.id} label={r.trigger === 'date' ? 'Due date' : 'Due details'}>
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
            const type = S.PTYPE_LABEL[d.ptype] || 'Property';
            const title = [
              type,
              d.communityId ? 'in ' + d.communityId : '',
              d.purpose === 'rent' ? 'for rent' : 'for sale',
            ]
              .filter(Boolean)
              .join(' ');
            const description = [
              title + '.',
              l.beds !== '' && l.beds != null ? (l.beds === 0 ? 'Studio layout.' : l.beds + ' bedrooms.') : '',
              l.size ? 'Area: ' + l.size.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' sq ft.' : '',
              l.furnishing ? l.furnishing + '.' : '',
              l.view ? l.view + ' view.' : '',
              ...(l.highlights || []),
            ]
              .filter(Boolean)
              .join('\n\n');
            ed.set('editor.d', { ...d, title: title.slice(0, 100), description });
          }}
        >
          <Icon name="magic" />
          Generate from property details
        </button>
        <p className="mt-2 text-xs text-muted">Creates an editable template using only the details you entered.</p>
      </div>
    );
  const rows = l.highlights || [];
  return (
    <div id="designer-highlights" tabIndex={-1}>
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
        <Field id="f-primary-broker" label="Primary broker" error={ed.errors.primaryBroker}>
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
            : [
                ['BRN', credentials.brn],
                ['ORN', credentials.orn || agency.orn],
                [
                  'Brokerage',
                  agency.name || credentials.agencyName || (u.type === 'independent' ? 'Independent broker' : ''),
                ],
              ]
          ).map(([label, value]) => (
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
        <p className="font-semibold">Contact from your account</p>
        <p className="mt-1 text-muted">
          {[
            u.portfolio?.publicPhone || profile.phone,
            u.portfolio?.whatsapp || profile.whatsapp,
            u.portfolio?.publicEmail || u.email,
          ]
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

export function ReviewSummary({ ed }) {
  const st = editorState(ed.L),
    c = S.ctxOf(st.d);
  const warnings = S.validateListing(st).warns;
  const jump = (step, key) => {
    ed.go(step, true);
    setTimeout(() => focusListingField('designer-' + key), 50);
  };
  return (
    <div className="space-y-4">
      {S.STEPS.slice(0, 7).map((step, i) => {
        const keys = S.activeFieldKeys(c, st.d, i),
          allStepKeys = [...new Set(step.sections.flatMap((section) => section.fields || []))] as string[],
          hiddenKeys = allStepKeys.filter((key) => !keys.includes(key) && !U.isBlank(st.d[key]) && st.d[key] !== false),
          invalid = validateEditorStep(i + 1, ed.L, ed.user);
        return (
          <div key={step.id} className="rounded-lg border border-line p-4">
            <div className="flex justify-between gap-3">
              <h4 className="font-semibold text-[13px]">{step.title}</h4>
              <button type="button" className="text-xs underline" onClick={() => ed.go(i + 1, true)}>
                Edit step
              </button>
            </div>
            <dl className="mt-3 space-y-2">
              {keys
                .filter((key) => !U.isBlank(st.d[key]) && st.d[key] !== false)
                .map((key) => {
                  const f = S.FIELDS[key],
                    value = st.d[key];
                  const label = S.labelOf(f, c, st.d);
                  const display =
                    f.kind === 'check'
                      ? 'Confirmed'
                      : f.kind === 'area'
                        ? value.raw + ' ' + (value.unit === 'sqm' ? 'sq m' : 'sq ft')
                        : Array.isArray(value)
                          ? value.map((v) => S.optsOf(f, c, st.d).find((o) => o.v === v)?.l || v).join(', ')
                          : S.optsOf(f, c, st.d).find((o) => o.v === value)?.l || String(value);
                  const privateField =
                    (f.priv && key !== 'floorNo') ||
                    (key === 'floorNo' && st.d.floorDisplay !== 'exact') ||
                    (['rentalIncome', 'tenancyExpiry'].includes(key) && st.d.tenancyPublic !== 'show');
                  return (
                    <div key={key} className="grid gap-1 text-xs sm:grid-cols-[minmax(0,180px)_1fr_auto]">
                      <dt className="text-muted">
                        {label}
                        <span className="ml-1 text-2xs">
                          (
                          {[
                            'areaUnit',
                            'locPrecision',
                            'floorDisplay',
                            'portfolio',
                            'promotion',
                            'scheduleDate',
                            'overrideContact',
                            'mediaRights',
                            'authType',
                            'authExpiry',
                            'finSource',
                            'finDate',
                            'priceBasis',
                            'bookingBasis',
                            'depositBasis',
                            'commBasis',
                          ].includes(key)
                            ? 'Not shown'
                            : privateField
                              ? 'Private'
                              : 'Public'}
                          )
                        </span>
                      </dt>
                      <dd className="min-w-0 whitespace-pre-wrap break-words">
                        {display.length > 250 ? display.slice(0, 250) + '…' : display}
                      </dd>
                      <dd>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => jump(i + 1, key)}
                          aria-label={'Edit ' + label}
                        >
                          Edit
                        </button>
                      </dd>
                    </div>
                  );
                })}
            </dl>
            {hiddenKeys.length > 0 && (
              <div className="mt-3 rounded bg-mist p-3 text-xs text-muted">
                <p className="font-semibold">Not shown for this property</p>
                <p className="mt-1">
                  {hiddenKeys.map((key) => S.labelOf(S.FIELDS[key], c, st.d)).join(', ')}. These answers remain in your
                  draft.
                </p>
                <button type="button" className="mt-2 underline" onClick={() => ed.go(1, true)}>
                  Edit classification
                </button>
              </div>
            )}
            {i === 3 && st.extraTerms?.length > 0 && (
              <div className="mt-3 text-xs">
                <p className="font-semibold">Additional terms (Public)</p>
                {st.extraTerms.map((term) => (
                  <p key={term.id} className="mt-1">
                    {[term.label, term.amount ? 'AED ' + term.amount : '', term.freq, term.payer, term.notes]
                      .filter(Boolean)
                      .join(' \u00b7 ')}
                  </p>
                ))}
              </div>
            )}
            {i === 1 && (
              <p className="mt-2 text-xs text-muted">
                {st.d.communityId} · {st.d.buildingName || st.d.propName || 'No building specified'}
              </p>
            )}
            {i === 2 && (
              <p className="mt-2 text-xs text-muted">
                {ed.L.amenities.length} amenities · {(st.custom || []).length} additional features
              </p>
            )}
            {i === 5 && (
              <p className="mt-2 text-xs text-muted">
                {ed.L.photos.length} photos · {ed.L.featured ? 'Cover chosen' : 'Cover missing'}
              </p>
            )}
            {invalid.length > 0 && (
              <ul className="mt-3 space-y-1">
                {invalid.map((e) => (
                  <li key={e.key}>
                    <button
                      type="button"
                      className="text-xs text-danger underline"
                      onClick={() => {
                        ed.go(i + 1, false);
                        setTimeout(() => focusListingField(e.id), 50);
                      }}
                    >
                      {e.msg}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {Object.keys(warnings).length > 0 && (
        <div className="rounded-lg bg-mist p-4">
          <h4 className="font-semibold text-sm">Quality suggestions</h4>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
            {Object.entries(warnings).map(([key, message]) => (
              <li key={key}>{String(message)}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted">
        Private identifiers, internal notes and private documents are excluded from the public preview. Hidden answers
        are retained in your draft and omitted from the public listing.
      </p>
    </div>
  );
}
