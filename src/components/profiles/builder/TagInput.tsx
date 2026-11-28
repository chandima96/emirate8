import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export function TagInput({ id, path, values, onChange, suggest = [], placeholder = 'Type and press Enter', describedBy }: { id: string; path: string; values: string[]; onChange: (v: string[]) => void; suggest?: string[]; placeholder?: string; describedBy: string }) {
  const [text, setText] = useState('');
  const add = (v: string) => {
    v = v.replace(/,/g, '').trim().slice(0, 60);
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setText('');
  };
  const sug = suggest.filter((s) => values.indexOf(s) < 0);
  return (
    <>
      <div className="taginput" data-tags={path}>
        {values.map((t, i) => (
          <span className="tag" key={t}>
            {t}
            <button type="button" aria-label={'Remove ' + t} onClick={() => { onChange(values.filter((_, j) => j !== i)); document.getElementById(id)?.focus(); }}>
              <Icon name="x" />
            </button>
          </span>
        ))}
        <input
          id={id}
          aria-labelledby={id + '-l'}
          aria-describedby={describedBy}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1));
          }}
        />
      </div>
      {!!sug.length && (
        <div className="suggests" aria-label="Suggestions">
          {sug.slice(0, 8).map((s) => (
            <button key={s} type="button" onClick={() => add(s)}>
              <Icon name="plus" />
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
