'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/utils';

/** A photo AI listing found: an image file the user attached, or a photo on a page they linked. */
export type AiPhoto = { id: string; kind: 'file' | 'link'; file?: File; url?: string; preview: string; name: string; source: string; other?: boolean };

type Props = {
  photos: AiPhoto[];
  setPhotos: (next: AiPhoto[] | ((current: AiPhoto[]) => AiPhoto[])) => void;
  /** Runs the normal photo pipeline (checks, duplicates, resizing, upload). */
  onAdd: (files: File[]) => Promise<void>;
  slots: number;
};

const release = (photo: AiPhoto) => photo.kind === 'file' && URL.revokeObjectURL(photo.preview);

async function download(photo: AiPhoto) {
  const response = await fetch(photo.preview, { credentials: 'same-origin' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'The photo could not be downloaded.');
  const blob = await response.blob();
  const ext = blob.type === 'image/png' ? '.png' : blob.type === 'image/webp' ? '.webp' : '.jpg';
  const base = photo.name.replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'photo';
  return new File([blob], base + ext, { type: blob.type });
}

/** "Photos found by AI": the user picks which ones join the gallery. Photos from websites usually belong to
 * someone else, so they can only be added after the user confirms they may use them. */
export function AiPhotoSuggestions({ photos, setPhotos, onAdd, slots }: Props) {
  // The listing's own photos start selected; other images on the page (similar listings, articles) start
  // unselected and hidden.
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [showOther, setShowOther] = useState(false);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Record<string, string>>({});
  if (!photos.length) return null;

  const isPicked = (p: AiPhoto) => picked[p.id] ?? !p.other;
  const own = photos.filter((p) => !p.other);
  const other = photos.filter((p) => p.other);
  const visible = showOther || !own.length ? photos : own;
  const chosen = photos.filter((p) => isPicked(p) && !failed[p.id]);
  const needsRights = chosen.some((p) => p.kind === 'link');
  const tooMany = chosen.length > slots;
  const remove = (ids: string[]) =>
    setPhotos((current) => current.filter((p) => (ids.includes(p.id) ? (release(p), false) : true)));

  async function add() {
    if (!chosen.length || (needsRights && !rights) || tooMany) return;
    setBusy(true);
    try {
      const files: File[] = [];
      const errors: Record<string, string> = {};
      const done: string[] = [];
      for (const photo of chosen) {
        try {
          files.push(photo.kind === 'file' ? (photo.file as File) : await download(photo));
          done.push(photo.id);
        } catch (error) {
          errors[photo.id] = error instanceof Error ? error.message : 'The photo could not be downloaded.';
        }
      }
      setFailed((current) => ({ ...current, ...errors }));
      if (files.length) await onAdd(files);
      remove(done);
    } finally {
      setBusy(false);
    }
  }

  const fromLinks = photos.some((p) => p.kind === 'link');
  const grid = (list: AiPhoto[]) => (
    <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
      {list.map((photo) => {
        const on = isPicked(photo) && !failed[photo.id];
        return (
          <li key={photo.id} className={cx('relative overflow-hidden rounded-md border bg-white', on ? 'border-[#4338a8] ring-2 ring-[#4338a8]/30' : 'border-line')}>
            <label className="block cursor-pointer">
              <input
                type="checkbox"
                className="absolute top-1.5 left-1.5 z-10 h-4 w-4"
                checked={on}
                disabled={busy || !!failed[photo.id]}
                onChange={(e) => setPicked((current) => ({ ...current, [photo.id]: e.target.checked }))}
                aria-label={'Add ' + photo.name + ' from ' + photo.source}
              />
              <div className="aspect-[4/3] bg-mist">
                <img
                  src={photo.preview}
                  alt=""
                  loading="lazy"
                  className={cx('h-full w-full object-cover', failed[photo.id] && 'opacity-40')}
                  // A link that isn't a usable photo is dropped from the list.
                  onError={() => photo.kind === 'link' && remove([photo.id])}
                />
              </div>
              <span className="block truncate px-1.5 py-1 text-2xs text-muted" title={photo.source}>
                {failed[photo.id] || photo.source}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="mt-5 rounded-md border border-[#d9d6ff] bg-[#f6f5ff] p-4" aria-labelledby="ai-photos-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="ai-photos-title" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="stars" className="text-[#4338a8]" />
            {own.length || photos.length} photo{(own.length || photos.length) === 1 ? '' : 's'} found by AI
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Check the photos of this property to add. Untick logos, maps or anything that isn’t this property.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setPicked((current) => ({ ...current, ...Object.fromEntries(visible.map((p) => [p.id, true])) }))}>
            Select all
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setPicked(Object.fromEntries(photos.map((p) => [p.id, false])))}>
            Clear
          </button>
        </div>
      </div>
      {grid(own.length ? own : other)}
      {!!own.length && !!other.length && (
        <div className="mt-3">
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showOther} onClick={() => setShowOther(!showOther)}>
            <Icon name={showOther ? 'chevron-up' : 'chevron-down'} />
            {showOther ? 'Hide' : 'Show'} {other.length} more image{other.length === 1 ? '' : 's'} from the page
          </button>
          {showOther && (
            <>
              <p className="mt-1 text-xs text-muted">These appear elsewhere on the page, such as similar listings, the area or articles. They are usually not this property.</p>
              {grid(other)}
            </>
          )}
        </div>
      )}
      {fromLinks && (
        <label className="mt-3 flex items-start gap-2 text-xs text-ink">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={rights} disabled={busy} onChange={(e) => setRights(e.target.checked)} />
          <span>
            I own the selected website photos or have the owner’s permission to use them in this listing. Photos on property
            portals usually belong to another agent or the portal.
          </span>
        </label>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-dark btn-sm" disabled={busy || !chosen.length || (needsRights && !rights) || tooMany} onClick={add}>
          <Icon name={busy ? 'arrow-repeat' : 'plus-lg'} />
          {busy ? 'Adding…' : `Add ${chosen.length || ''} photo${chosen.length === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => remove(photos.map((p) => p.id))}>
          Dismiss
        </button>
        <span className="text-xs text-muted" aria-live="polite">
          {tooMany ? `Only ${slots} more photo${slots === 1 ? '' : 's'} fit in this listing.` : needsRights && !rights ? 'Confirm you may use the website photos to add them.' : ''}
        </span>
      </div>
    </section>
  );
}
