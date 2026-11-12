'use client';

import { AiField as Field } from '@/components/ui/AiAssist';
import { invalidProps } from '@/components/ui/Field';
import { listingSchema as S } from './designer-schema';

export function DesignerField({ ed, fieldKey }: { ed: any; fieldKey: string }) {
  const d = ed.L.editor.d,
    c = S.ctxOf(d),
    f = S.FIELDS[fieldKey];
  if (!f || (f.when && !f.when(c, d))) return null;
  const id = 'designer-' + fieldKey,
    error = ed.errors[fieldKey];
  const kind = S.effKind(f, d),
    required = S.isReq(f, c, d);
  const label = fieldKey === 'notes' && ed.isDeveloper ? 'Internal developer notes' : S.labelOf(f, c, d);
  const help = typeof f.help === 'function' ? f.help(c, d) : f.help;
  const value = d[fieldKey] ?? (kind === 'multi' ? [] : '');
  const opts = fieldKey === 'portfolio' ? [{ v: 'default', l: 'My public portfolio' }] : S.optsOf(f, c, d);
  const change = async (next) => {
    const nextData = { ...d, [fieldKey]: next };
    if (fieldKey === 'category') nextData.ptype = '';
    if (['purpose', 'category', 'ptype', 'devStatus', 'txn', 'occupancy'].includes(fieldKey)) {
      const nextKeys = new Set(S.activeFieldKeys(S.ctxOf(nextData), nextData));
      const hidden = S.activeFieldKeys(c, d).filter(
        (key) => !nextKeys.has(key) && !S.util.isBlank(d[key]) && d[key] !== false,
      );
      if (
        hidden.length &&
        !(await ed.confirm({
          title: 'Change property classification?',
          body:
            'These answers will be hidden for this property: ' +
            hidden.map((key) => S.labelOf(S.FIELDS[key], c, d)).join(', ') +
            '. They stay in your draft and can be restored by switching back.',
          ok: 'Change classification',
          cancel: 'Keep current answers',
        }))
      )
        return;
    }
    ed.set('editor.d', nextData);
  };
  const toggle = (v) => {
    let next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    if ((f.exclusive || []).includes(v) && next.includes(v)) next = [v];
    else if (!(f.exclusive || []).includes(v)) next = next.filter((x) => !(f.exclusive || []).includes(x));
    void change(next);
  };
  const fieldProps = {
    id,
    label,
    error,
    optional: f.priv ? 'private' : required ? undefined : 'optional',
    hint: help,
    className:
      kind === 'textarea' || kind === 'check' || kind === 'multi' || kind === 'seg' ? 'sm:col-span-2' : undefined,
  };
  const patch = (values: Record<string, any>) => ed.set('editor.d', { ...d, ...values });
  const unitLabel = d.areaUnit === 'sqm' ? 'sq m' : 'sq ft';
  const shownArea = (raw) =>
    value?.unit && value.unit !== d.areaUnit && !S.util.isBlank(raw)
      ? S.util.fmtNum(S.util.areaIn({ raw, unit: value.unit }, d.areaUnit), 4).replace(/,/g, '')
      : raw ?? '';
  const rangeOn =
    !!f.rangeOk && (kind === 'area' ? !!value && value.rawMax !== undefined : d[fieldKey + 'Max'] !== undefined);
  const multiValues: string[] | null =
    f.multiOk && Array.isArray(d[fieldKey + 'Multi']) ? d[fieldKey + 'Multi'] : null;
  const multiOpts = opts.filter((o) => !S.MULTI_EXCLUDED.includes(o.v));
  const setArea = (raw: string, rawMax?: string) =>
    void change({
      raw,
      unit: d.areaUnit || 'sqft',
      ...(rangeOn ? { rawMax: rawMax ?? shownArea(value?.rawMax) } : {}),
    });
  const toggleRange = () =>
    kind === 'area'
      ? patch({
          [fieldKey]: rangeOn
            ? { raw: value?.raw || '', unit: value?.unit || d.areaUnit || 'sqft' }
            : { raw: value?.raw || '', unit: value?.unit || d.areaUnit || 'sqft', rawMax: '' },
        })
      : patch({ [fieldKey + 'Max']: rangeOn ? undefined : '' });
  const toggleMultiMode = () =>
    patch(
      multiValues
        ? { [fieldKey + 'Multi']: undefined }
        : { [fieldKey + 'Multi']: value && !S.MULTI_EXCLUDED.includes(value) ? [value] : [] },
    );
  const toggleMultiValue = (v: string) => {
    const chosen = multiValues || [];
    const next = multiOpts.map((o) => o.v).filter((x) => (x === v ? !chosen.includes(v) : chosen.includes(x)));
    patch({ [fieldKey + 'Multi']: next, [fieldKey]: next[0] || '' });
  };
  const modeToggle =
    f.rangeOk && ['money', 'area'].includes(kind) ? (
      <button type="button" className="text-2xs font-semibold text-sage-ink underline" aria-pressed={rangeOn} onClick={toggleRange}>
        {rangeOn ? 'Single value' : 'Enter a range'}
      </button>
    ) : f.multiOk && ['select', 'seg'].includes(kind) ? (
      <button type="button" className="text-2xs font-semibold text-sage-ink underline" aria-pressed={!!multiValues} onClick={toggleMultiMode}>
        {multiValues ? 'Choose one' : 'Choose several'}
      </button>
    ) : null;
  if (multiValues) fieldProps.className = 'sm:col-span-2';
  if (kind === 'check')
    return (
      <div className="sm:col-span-2" id={id + '-group'}>
        <label className="check" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => void change(e.target.checked)}
            {...invalidProps(id, error)}
          />
          <span>{label}</span>
        </label>
        {help && <p className="mt-1 text-xs text-muted">{help}</p>}
        {error && (
          <p id={id + '-err'} className="err" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <Field
      {...fieldProps}
      labelAside={
        f.max ? (
          <span className="text-2xs text-muted">
            {String(value).length} / {f.max}
          </span>
        ) : (
          modeToggle || undefined
        )
      }
    >
      {multiValues ? (
        <div
          id={id}
          tabIndex={-1}
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={label + ' (choose all that apply)'}
          {...invalidProps(id, error)}
        >
          {multiOpts.map((o) => (
            <button
              key={o.v}
              type="button"
              className="tog-chip"
              aria-pressed={multiValues.includes(o.v)}
              onClick={() => toggleMultiValue(o.v)}
            >
              {o.l}
            </button>
          ))}
        </div>
      ) : kind === 'select' ? (
        <select
          id={id}
          className="select"
          value={value}
          onChange={(e) => void change(e.target.value)}
          {...invalidProps(id, error)}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {opts.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      ) : kind === 'seg' ? (
        <div
          id={id}
          tabIndex={-1}
          role="radiogroup"
          aria-label={label}
          className="grid gap-2 sm:grid-cols-2"
          {...invalidProps(id, error)}
        >
          {opts.map((o) => (
            <button
              key={o.v}
              type="button"
              className="choice"
              role="radio"
              aria-checked={value === o.v}
              onClick={() => void change(o.v)}
            >
              <span className="radio-dot" />
              <span>
                <span className="block text-[13px] font-semibold">{o.l}</span>
                {o.h && <span className="mt-1 block text-xs text-muted">{o.h}</span>}
              </span>
            </button>
          ))}
        </div>
      ) : kind === 'multi' ? (
        <div
          id={id}
          tabIndex={-1}
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={label}
          {...invalidProps(id, error)}
        >
          {opts.map((o) => (
            <button
              key={o.v}
              type="button"
              className="tog-chip"
              aria-pressed={value.includes(o.v)}
              onClick={() => toggle(o.v)}
            >
              {o.l}
            </button>
          ))}
        </div>
      ) : kind === 'textarea' ? (
        <textarea
          id={id}
          className="textarea"
          rows={f.rows || 4}
          maxLength={f.max}
          value={value}
          placeholder={f.ph}
          onChange={(e) => void change(e.target.value)}
          {...invalidProps(id, error)}
        />
      ) : kind === 'area' ? (
        <div>
          <div className="flex items-center gap-2">
            <input
              id={id}
              className="input"
              inputMode="decimal"
              aria-label={rangeOn ? label + ' from' : undefined}
              value={shownArea(value?.raw)}
              onChange={(e) => setArea(e.target.value)}
              {...invalidProps(id, error)}
            />
            {rangeOn && (
              <>
                <span className="shrink-0 text-xs text-muted">to</span>
                <input
                  id={id + '-max'}
                  className="input"
                  inputMode="decimal"
                  aria-label={label + ' to'}
                  value={shownArea(value?.rawMax)}
                  onChange={(e) => setArea(shownArea(value?.raw), e.target.value)}
                />
              </>
            )}
            <span className="shrink-0 text-xs text-muted">{unitLabel}</span>
          </div>
          {value?.raw && value.unit !== d.areaUnit && (
            <p className="mt-1 text-xs text-muted">
              Entered as {value.raw}
              {rangeOn && value.rawMax ? ' – ' + value.rawMax : ''} {value.unit === 'sqm' ? 'sq m' : 'sq ft'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            id={id}
            className="input"
            type={
              kind === 'date'
                ? 'date'
                : kind === 'email'
                  ? 'email'
                  : kind === 'url'
                    ? 'url'
                    : kind === 'phone'
                      ? 'tel'
                      : 'text'
            }
            inputMode={
              ['money', 'pct', 'dec'].includes(kind)
                ? 'decimal'
                : ['int', 'year'].includes(kind)
                  ? 'numeric'
                  : undefined
            }
            maxLength={f.max}
            value={value}
            placeholder={f.ph}
            aria-label={rangeOn ? label + ' from' : undefined}
            onChange={(e) => void change(e.target.value)}
            {...invalidProps(id, error)}
          />
          {rangeOn && kind === 'money' && (
            <>
              <span className="shrink-0 text-xs text-muted">to</span>
              <input
                id={id + '-max'}
                className="input"
                inputMode="decimal"
                aria-label={label + ' to'}
                value={d[fieldKey + 'Max'] ?? ''}
                onChange={(e) => patch({ [fieldKey + 'Max']: e.target.value })}
              />
            </>
          )}
          {(kind === 'money' || kind === 'pct' || f.suffix) && (
            <span className="shrink-0 text-xs text-muted">
              {kind === 'money' ? 'AED' : kind === 'pct' ? '%' : f.suffix}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
