import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AREAS } from '@/config/reference';
import { slugify } from '@/lib/utils';

const COMMUNITIES: string[] = Array.from(new Set(Object.values(AREAS as Record<string, string[]>).flat()));

export function LocationPicker({ chosen, onAdd, invalid }: { chosen: string[]; onAdd: (name: string) => void; invalid: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  const ql = q.trim().toLowerCase();
  const opts = COMMUNITIES.filter((c) => !ql || c.toLowerCase().indexOf(ql) > -1);
  const custom = ql && !COMMUNITIES.some((c) => c.toLowerCase() === ql) ? q.trim() : null;
  const items = [...opts.map((c) => ({ name: c, label: c, chosen: chosen.includes(c), id: 'loc-o-' + slugify(c) })), ...(custom ? [{ name: custom, label: `Add “${custom}” as another UAE location`, chosen: chosen.includes(custom), id: 'loc-o-custom' }] : [])];
  const pickable = items.filter((x) => !x.chosen);
  const pick = (name: string) => {
    onAdd(name);
    setQ('');
    setIdx(-1);
  };
  return (
    <div className="locpick" ref={wrap}>
      <input
        className="input"
        id="loc-input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="loc-list"
        aria-activedescendant={open && pickable[idx] ? pickable[idx].id : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        placeholder="Search Dubai communities and other UAE locations"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setIdx(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setIdx((i) => Math.max(0, Math.min(pickable.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (pickable[idx]) pick(pickable[idx].name);
            else if (pickable.length === 1) pick(pickable[0].name);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <ul className="locpick__list" id="loc-list" role="listbox" aria-label="Locations" hidden={!open || !items.length}>
        {items.map((x) => (
          <li key={x.id} role="option" id={x.id} aria-selected={pickable[idx]?.id === x.id} aria-disabled={x.chosen} className={x.chosen ? 'is-chosen' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => !x.chosen && pick(x.name)}>
            {x.label}
            {x.chosen && <span className="xs">Added</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
