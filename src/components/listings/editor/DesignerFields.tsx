'use client';

import { Field, invalidProps } from '@/components/ui/Field';
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
        ) : undefined
      }
    >
      {kind === 'select' ? (
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
              value={
                value?.unit && value.unit !== d.areaUnit
                  ? S.util.fmtNum(S.util.areaIn(value, d.areaUnit), 4).replace(/,/g, '')
                  : value?.raw || ''
              }
              onChange={(e) => void change({ raw: e.target.value, unit: d.areaUnit || 'sqft' })}
              {...invalidProps(id, error)}
            />
            <span className="shrink-0 text-xs text-muted">{d.areaUnit === 'sqm' ? 'sq m' : 'sq ft'}</span>
          </div>
          {value?.raw && value.unit !== d.areaUnit && (
            <p className="mt-1 text-xs text-muted">
              Entered as {value.raw} {value.unit === 'sqm' ? 'sq m' : 'sq ft'}
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
            onChange={(e) => void change(e.target.value)}
            {...invalidProps(id, error)}
          />
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
