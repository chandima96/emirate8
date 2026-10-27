'use client';

import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field, invalidProps } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { cx, fmtBytes } from '@/lib/utils';
import { uploadMediaDataURL, uploadMediaFile } from '@/lib/mediaClient';
import { EditorSection } from './EditorSection';
import { inspectPhoto } from './photoChecks';
import { IMAGE_TYPES, LIBRARY, MAX_PHOTOS, readImage } from './model';

const focusLater = (selector) =>
  setTimeout(() => {
    const el = document.querySelector(selector);
    el?.focus();
  }, 30);

/** Step 6: photo manager (upload, processing, drag/keyboard reorder, captions, replace, remove, featured photo),
 * sample library, floor plans, brochure, master plan and video / tour links. */
export function StepMedia({ ed }) {
  const { L, t, set, update, toast, errors, latest } = ed;
  const [uploading, setUploading] = useState(0);
  const [progress, setProgress] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [over, setOver] = useState(null);
  const [library, setLibrary] = useState(false);
  const dragRef = useRef(null);
  const photoHashes = useRef(new Set<string>());
  const photoSlots = useRef(0);
  const photos = L.photos;
  const n = photos.length;

  /* ---------- photos ---------- */
  function setFeatured(src) {
    update((p) => {
      const list = p.photos.slice();
      const i = list.findIndex((x) => x.src === src);
      if (i > 0) list.unshift(list.splice(i, 1)[0]); // featured photo leads the gallery
      return { ...p, photos: list, featured: src };
    });
    toast('Featured photo updated — it now leads the gallery and every listing card.', { icon: 'star-fill' });
    focusLater('[data-ph="0"] [data-cap]');
  }
  function move(i, d) {
    const j = i + d;
    const list = photos.slice();
    [list[i], list[j]] = [list[j], list[i]];
    let featured = L.featured;
    if (list[0].src !== featured && (i === 0 || j === 0)) {
      featured = list[0].src;
      toast('Photo 1 is now the featured photo.', { icon: 'star-fill' });
    }
    update((p) => ({ ...p, photos: list, featured }));
    focusLater(`[data-pmove="${j}:${d}"]:not(:disabled), [data-pmove="${j}:${-d}"]`);
  }
  function removePhoto(k) {
    const list = photos.filter((_, i) => i !== k);
    const wasFeat = photos[k].src === L.featured;
    if (photos[k].hash) photoHashes.current.delete(photos[k].hash);
    let featured = L.featured;
    if (wasFeat) {
      featured = list[0] ? list[0].src : '';
      toast(
        list.length
          ? 'Featured photo removed — photo 1 is now featured. Choose another if you prefer.'
          : 'Photo removed. Add photos and choose a featured photo.',
        { icon: 'exclamation-circle', duration: 5000 },
      );
    }
    update((p) => ({ ...p, photos: list, featured }));
  }
  function caption(i, v) {
    update((p) => ({ ...p, photos: p.photos.map((x, j) => (j === i ? { ...x, caption: v } : x)) }));
  }
  async function replace(i, file) {
    const original = latest().photos[i];
    if (!original) return;
    let reservedHash;
    try {
      const metadata = await inspectPhoto(file);
      if (photoHashes.current.has(metadata.hash) || latest().photos.some((p) => p.hash === metadata.hash)) {
        toast(file.name + ' is already in this gallery.');
        return;
      }
      photoHashes.current.add(metadata.hash);
      reservedHash = metadata.hash;
      const src = await readImage(file, 1280, 0.74);
      const media = await uploadMediaDataURL(src, file.name, file.name);
      update((p) => ({
        ...p,
        photos: p.photos.map((photo) =>
          photo.src === original.src ? { ...photo, ...metadata, src: media.url, mediaId: media.id } : photo,
        ),
        featured: p.featured === original.src ? media.url : p.featured,
      }));
      if (original.hash) photoHashes.current.delete(original.hash);
      toast(
        metadata.lowResolution
          ? 'Photo replaced. The source image is below the recommended 1280 x 720 resolution.'
          : 'Photo replaced.',
      );
    } catch (error) {
      if (reservedHash) photoHashes.current.delete(reservedHash);
      toast(error instanceof Error ? error.message : String(error), { icon: 'exclamation-circle' });
    }
  }
  async function addFiles(fileList: FileList) {
    const files = Array.from(fileList || []);
    setUploading((u) => u + files.length);
    const notices = [];
    let added = 0;
    try {
      for (const file of files) {
        let reservedHash;
        let reservedSlot = false;
        try {
          if (latest().photos.length >= MAX_PHOTOS)
            throw new Error(file.name + ': the ' + MAX_PHOTOS + '-photo limit has been reached.');
          const metadata = await inspectPhoto(file);
          if (photoHashes.current.has(metadata.hash) || latest().photos.some((p) => p.hash === metadata.hash))
            throw new Error(file.name + ': duplicate photo skipped.');
          if (latest().photos.length + photoSlots.current >= MAX_PHOTOS)
            throw new Error(file.name + ': the photo limit has been reached.');
          photoSlots.current++;
          reservedSlot = true;
          photoHashes.current.add(metadata.hash);
          reservedHash = metadata.hash;
          const src = await readImage(file, 1280, 0.74);
          const media = await uploadMediaDataURL(src, file.name, file.name);
          update((p) => ({
            ...p,
            photos: [...p.photos, { ...metadata, src: media.url, mediaId: media.id, caption: '', imgType: 'actual' }],
          }));
          added++;
          if (metadata.lowResolution)
            notices.push(
              file.name +
                ': low resolution (' +
                metadata.width +
                ' x ' +
                metadata.height +
                '). A larger image is recommended.',
            );
        } catch (error) {
          if (reservedHash) photoHashes.current.delete(reservedHash);
          notices.push(error instanceof Error ? error.message : String(error));
        } finally {
          if (reservedSlot) photoSlots.current--;
          setUploading((u) => u - 1);
          setProgress({ done: files.indexOf(file) + 1, total: files.length });
        }
      }
    } finally {
      setProgress(null);
      toast(
        <>
          {added} photo{added === 1 ? '' : 's'} added.
          {notices.map((notice, i) => (
            <span key={i} className="mt-1 block">
              {notice}
            </span>
          ))}
        </>,
        { duration: notices.length ? 8000 : 3500 },
      );
    }
  }

  /* drag & drop reordering */
  function onDrop(to) {
    const from = dragRef.current;
    if (from == null) return;
    const list = photos.slice();
    const item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
    let featured = L.featured;
    if (to === 0 && item.src !== featured) {
      featured = item.src;
      toast('Moved to the first position — it is now the featured photo.', { icon: 'star-fill' });
    } else if (list[0].src !== featured && from === 0) featured = list[0].src;
    dragRef.current = null;
    setDragFrom(null);
    setOver(null);
    update((p) => ({ ...p, photos: list, featured }));
  }

  /* sample library */
  function toggleLibrary(src) {
    const i = photos.findIndex((p) => p.src === src);
    if (i > -1) {
      const list = photos.filter((p) => p.src !== src);
      update((p) => ({ ...p, photos: list, featured: p.featured === src ? (list[0] ? list[0].src : '') : p.featured }));
    } else if (photos.length < MAX_PHOTOS) update((p) => ({ ...p, photos: [...p.photos, { src, caption: '' }] }));
    else toast('Photo limit reached.');
  }

  /* floor plans, brochure, master plan */
  function addFloorplans(fileList: FileList) {
    const files = Array.from(fileList).slice(0, 10 - L.media.floorplans.length);
    Promise.all(
      files.map((f) =>
        (f.type === 'application/pdf' && f.size <= 20 * 1048576
          ? uploadMediaFile(f, f.name, f.name)
          : readImage(f, 1400, 0.8).then((src) => uploadMediaDataURL(src, f.name, f.name))
        )
          .then((media) => ({ ...media, name: f.name, mimetype: f.type }))
          .catch((error) => {
            toast(error.message || String(error), { icon: 'exclamation-circle' });
            return null;
          }),
      ),
    ).then((mediaFiles) =>
      update((p) => ({
        ...p,
        media: {
          ...p.media,
          floorplans: [
            ...p.media.floorplans,
            ...mediaFiles.filter(Boolean).map((media) => ({
              src: media.url,
              mediaId: media.id,
              name: media.name,
              mimetype: media.mimetype,
              caption: '',
              level: '',
            })),
          ],
        },
      })),
    );
  }
  async function addBrochure(f) {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      toast('Upload the brochure as a PDF.', { icon: 'exclamation-circle' });
      return;
    }
    if (f.size > 20 * 1048576) {
      toast('The brochure must be under 20 MB.', { icon: 'exclamation-circle' });
      return;
    }
    try {
      const media = await uploadMediaFile(f, f.name, f.name);
      set('media.brochure', { name: f.name, size: f.size, data: media.url, mediaId: media.id });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not upload the brochure.', { icon: 'exclamation-circle' });
    }
  }
  function addMaster(f) {
    if (!f) return;
    readImage(f, 1600, 0.8)
      .then((src) => uploadMediaDataURL(src, f.name, f.name))
      .then((media) => set('media.masterplan', media.url))
      .catch((error) => toast(error.message || String(error), { icon: 'exclamation-circle' }));
  }

  const status =
    progress && progress.done < progress.total
      ? 'Processed ' + progress.done + ' of ' + progress.total + '…'
      : n +
        ' / ' +
        MAX_PHOTOS +
        ' photos' +
        (!n ? ' ? add at least one photo to continue' : n < 8 ? ' ? 8?15 useful photos recommended' : '') +
        (n ? ' · featured: photo 1' : '');
  const br = L.media.brochure;

  return (
    <>
      <h2 className="h3" tabIndex={-1}>
        Photos &amp; media
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        Drag to reorder. The featured photo leads the gallery and appears on every card.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <label
          className={cx('dropzone', dropActive && 'is-drag')}
          htmlFor="f-photos"
          onDragEnter={(e) => {
            if (dragRef.current != null) return;
            e.preventDefault();
            setDropActive(true);
          }}
          onDragOver={(e) => {
            if (dragRef.current != null) return;
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDropActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDropActive(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <Icon name="cloud-upload" className="h-6 w-6 text-ink" />
          <span className="text-[13px] font-semibold text-ink">Drop photos here or browse</span>
          <span className="text-xs text-muted">JPG, PNG or WebP · up to 15 MB each · 30 photos</span>
        </label>
        <input
          id="f-photos"
          type="file"
          className="sr-only"
          accept={IMAGE_TYPES}
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <label className="btn btn-outline cursor-pointer sm:h-full">
          Take a photo
          <input
            type="file"
            className="sr-only"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <p className={'mt-3 text-[13px] ' + (!n ? 'text-warn' : 'text-muted')} aria-live="polite">
        {status}
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {photos.map((p, i) => {
          const feat = p.src === L.featured;
          return (
            <li
              key={p.src + i}
              className={cx('ph-card', feat && 'is-featured', dragFrom === i && 'is-dragging', over === i && 'is-over')}
              draggable="true"
              data-ph={i}
              onDragStart={(e) => {
                dragRef.current = i;
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
                try {
                  e.dataTransfer.setData('text/plain', String(i));
                } catch {
                  /* ignore */
                }
              }}
              onDragOver={(e) => {
                if (dragRef.current == null) return;
                e.preventDefault();
                if (over !== i) setOver(i);
              }}
              onDragLeave={() => over === i && setOver(null)}
              onDrop={(e) => {
                if (dragRef.current == null) return;
                e.preventDefault();
                onDrop(i);
              }}
              onDragEnd={() => {
                dragRef.current = null;
                setDragFrom(null);
                setOver(null);
              }}
            >
              <div className="relative aspect-[4/3] bg-mist">
                <img
                  src={p.src}
                  alt={'Photo ' + (i + 1) + (p.caption ? ': ' + p.caption : '')}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: (p.focalX ?? 50) + '% ' + (p.focalY ?? 50) + '%' }}
                  draggable="false"
                />
                <span className="ph-handle" title="Drag to reorder" aria-hidden="true">
                  <Icon name="grip-vertical" className="h-4 w-4" />
                </span>
                {feat ? (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-sm bg-ink px-1.5 py-0.5 text-2xs font-semibold text-white">
                    <Icon name="star-fill" className="h-3 w-3" />
                    Featured
                  </span>
                ) : (
                  <span className="absolute top-2 right-2 rounded-sm bg-white/95 px-1.5 py-0.5 text-2xs font-semibold text-ink">
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="p-2">
                <label className="sr-only" htmlFor={'cap-' + i}>
                  Caption for photo {i + 1}
                </label>
                <input
                  id={'cap-' + i}
                  className="input h-8 text-[12px]"
                  maxLength={60}
                  placeholder="Caption (optional)"
                  value={p.caption || ''}
                  data-cap={i}
                  onChange={(e) => caption(i, e.target.value)}
                />
                {p.lowResolution && (
                  <p className="mt-2 text-2xs text-warn">
                    Low resolution: {p.width} ? {p.height}. A larger original is recommended.
                  </p>
                )}
                <div className="mt-2 space-y-2">
                  <label className="block text-2xs text-muted">
                    Image type
                    <select
                      className="select h-8 text-xs"
                      value={p.imgType || 'actual'}
                      onChange={(e) =>
                        update((prev) => ({
                          ...prev,
                          photos: prev.photos.map((photo, j) =>
                            j === i ? { ...photo, imgType: e.target.value } : photo,
                          ),
                        }))
                      }
                    >
                      <option value="actual">Actual property</option>
                      <option value="show_unit">Show unit</option>
                      <option value="render">Developer render / artist impression</option>
                      <option value="construction">Construction update</option>
                    </select>
                  </label>
                  <label className="block text-2xs text-muted">
                    Photo category
                    <select
                      className="select h-8 text-xs"
                      value={p.category || ''}
                      onChange={(e) =>
                        update((prev) => ({
                          ...prev,
                          photos: prev.photos.map((photo, j) =>
                            j === i ? { ...photo, category: e.target.value } : photo,
                          ),
                        }))
                      }
                    >
                      <option value="">Select category</option>
                      {['Exterior', 'Living', 'Bedroom', 'Kitchen', 'Bathroom', 'View', 'Amenities', 'Other'].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </label>
                  {feat && (
                    <>
                      <label className="block text-2xs text-muted">
                        Cover crop: horizontal
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={p.focalX ?? 50}
                          onChange={(e) =>
                            update((prev) => ({
                              ...prev,
                              photos: prev.photos.map((photo, j) =>
                                j === i ? { ...photo, focalX: +e.target.value } : photo,
                              ),
                            }))
                          }
                        />
                      </label>
                      <label className="block text-2xs text-muted">
                        Cover crop: vertical
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={p.focalY ?? 50}
                          onChange={(e) =>
                            update((prev) => ({
                              ...prev,
                              photos: prev.photos.map((photo, j) =>
                                j === i ? { ...photo, focalY: +e.target.value } : photo,
                              ),
                            }))
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
                {feat ? (
                  <p className="mt-1.5 flex h-7 items-center gap-1 text-2xs font-semibold text-ink">
                    <Icon name="star-fill" className="h-3 w-3" />
                    Featured photo
                  </p>
                ) : (
                  <button
                    type="button"
                    className="mt-1.5 inline-flex h-7 items-center gap-1 text-2xs font-semibold text-ink underline underline-offset-2"
                    onClick={() => setFeatured(p.src)}
                  >
                    <Icon name="star" className="h-3 w-3" />
                    Set as Featured Photo
                  </button>
                )}
                <div className="flex items-center justify-between gap-1 border-t border-mist pt-1">
                  <span className="flex">
                    <button
                      type="button"
                      className="btn btn-ghost h-7 w-7 px-0"
                      data-pmove={i + ':-1'}
                      aria-label={'Move photo ' + (i + 1) + ' earlier'}
                      disabled={!i}
                      onClick={() => move(i, -1)}
                    >
                      <Icon name="arrow-left" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost h-7 w-7 px-0"
                      data-pmove={i + ':1'}
                      aria-label={'Move photo ' + (i + 1) + ' later'}
                      disabled={i >= n - 1}
                      onClick={() => move(i, 1)}
                    >
                      <Icon name="arrow-right" />
                    </button>
                    <label className="btn btn-ghost h-7 w-7 cursor-pointer px-0" title="Replace photo">
                      <span className="sr-only">Replace photo {i + 1}</span>
                      <Icon name="arrow-repeat" />
                      <input
                        type="file"
                        className="sr-only"
                        accept={IMAGE_TYPES}
                        data-replace={i}
                        onChange={(e) => {
                          const f = e.target.files[0];
                          e.target.value = '';
                          if (f) replace(i, f);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost h-7 w-7 px-0 text-danger"
                      aria-label={'Remove photo ' + (i + 1)}
                      onClick={() => removePhoto(i)}
                    >
                      <Icon name="trash3" />
                    </button>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
        {Array.from({ length: uploading }, (_, k) => (
          <li key={'up' + k} className="ph-card">
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-mist text-xs text-muted">
              <Icon name="hourglass-split" className="h-5 w-5" />
              Processing…
              <div className="meter w-2/3">
                <span className="w-2/3 animate-pulse" />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 border-t border-line pt-6 lg:grid-cols-2">
        <EditorSection
          id="section-md-fp"
          title="Floor plans"
          optional
          defaultOpen={L.media.floorplans.length > 0}
          hasErrors={!!errors.plans}
        >
          <label className="btn btn-outline btn-sm mt-3 cursor-pointer" htmlFor="f-floorplans">
            <Icon name="grid-1x2" />
            Add floor plans
          </label>
          <input
            id="f-floorplans"
            type="file"
            className="sr-only"
            accept={IMAGE_TYPES + ',application/pdf'}
            multiple
            onChange={(e) => {
              addFloorplans(e.target.files);
              e.target.value = '';
            }}
          />
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {L.media.floorplans.map((f, i) => (
              <li key={i} className="relative overflow-hidden rounded border border-line bg-white">
                <a href={f.src} target="_blank" rel="noreferrer">
                  {f.mimetype === 'application/pdf' ? (
                    <span className="flex aspect-square items-center justify-center p-3 text-xs">PDF floor plan</span>
                  ) : (
                    <img
                      src={f.src}
                      alt={f.name || 'Floor plan ' + (i + 1)}
                      className="aspect-square w-full object-contain p-1"
                    />
                  )}
                </a>
                <label className="sr-only" htmlFor={'plan-name-' + i}>
                  Layout name
                </label>
                <input
                  id={'plan-name-' + i}
                  className="input h-8 text-xs"
                  placeholder="Layout name"
                  value={f.name || f.caption || ''}
                  onChange={(e) =>
                    set(
                      'media.floorplans',
                      L.media.floorplans.map((p, j) =>
                        j === i ? { ...p, name: e.target.value, caption: e.target.value } : p,
                      ),
                    )
                  }
                />
                <label className="sr-only" htmlFor={'plan-level-' + i}>
                  Floor / Level
                </label>
                <input
                  id={'plan-level-' + i}
                  className="input mt-1 h-8 text-xs"
                  placeholder="Floor / Level (optional)"
                  maxLength={60}
                  value={f.level || ''}
                  onChange={(e) =>
                    set(
                      'media.floorplans',
                      L.media.floorplans.map((plan, j) => (j === i ? { ...plan, level: e.target.value } : plan)),
                    )
                  }
                />
                <button
                  type="button"
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-danger shadow-card"
                  aria-label={'Remove floor plan ' + (i + 1)}
                  onClick={() =>
                    set(
                      'media.floorplans',
                      L.media.floorplans.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Icon name="x-lg" className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </EditorSection>
        <div className="grid gap-4">
          {[['f-video', 'media.video', 'Property video URL']].map(([id, path, label]) => (
            <Field key={id} id={id} label={label} optional="optional" error={errors[path]}>
              <input
                id={id}
                type="url"
                className="input"
                placeholder="https://"
                value={L.media[path.split('.')[1]] || ''}
                onChange={(e) => set(path, e.target.value)}
                {...invalidProps(id, errors[path])}
              />
            </Field>
          ))}
        </div>
        <EditorSection id="section-md-br" title="Brochure (PDF)" optional defaultOpen={!!br}>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="btn btn-outline btn-sm cursor-pointer" htmlFor="f-brochure">
              <Icon name="file-earmark-pdf" />
              Upload brochure
            </label>
            <input
              id="f-brochure"
              type="file"
              className="sr-only"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files[0];
                e.target.value = '';
                addBrochure(f);
              }}
            />
            <span className="text-[13px]">
              {br ? (
                <>
                  {br.name}{' '}
                  <span className="text-muted">
                    ({fmtBytes(br.size)}
                    {br.data ? '' : ', name only'})
                  </span>{' '}
                  <button
                    type="button"
                    className="ml-1 text-danger underline"
                    onClick={() => set('media.brochure', null)}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="text-muted">No brochure</span>
              )}
            </span>
          </div>
        </EditorSection>
        {t.offplan && (
          <EditorSection id="section-md-master" title="Master plan (image)" optional defaultOpen={!!L.media.masterplan}>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="btn btn-outline btn-sm cursor-pointer" htmlFor="f-master">
                <Icon name="map" />
                Upload master plan
              </label>
              <input
                id="f-master"
                type="file"
                className="sr-only"
                accept={IMAGE_TYPES}
                onChange={(e) => {
                  const f = e.target.files[0];
                  e.target.value = '';
                  addMaster(f);
                }}
              />
              {L.media.masterplan ? (
                <span className="inline-flex items-center gap-2">
                  <img
                    src={L.media.masterplan}
                    alt="Master plan"
                    className="h-12 w-16 rounded border border-line object-cover"
                  />
                  <button
                    type="button"
                    className="text-[13px] text-danger underline"
                    onClick={() => set('media.masterplan', '')}
                  >
                    Remove
                  </button>
                </span>
              ) : (
                <span className="text-[13px] text-muted">No master plan</span>
              )}
            </div>
          </EditorSection>
        )}
      </div>
      <p className="mt-6 flex items-start gap-2 rounded-lg bg-mist px-4 py-3 text-xs leading-[1.6] text-muted">
        <Icon name="info-circle" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
        Images are resized before saving with your listing record in Supabase. Media sections only appear publicly when
        content is provided.
      </p>

      <Modal open={library} onClose={() => setLibrary(false)} labelledBy="lib-title" panelClassName="sm:max-w-[760px]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="lib-title" className="h4">
            Sample photo library
          </h2>
          <button
            type="button"
            className="btn btn-ghost h-9 w-9 px-0"
            aria-label="Close"
            onClick={() => setLibrary(false)}
          >
            <Icon name="x-lg" />
          </button>
        </div>
        <p className="px-5 pt-4 text-xs text-muted">
          Licensed photography (see Terms › Credits) for trying the editor. Use your own photos for real listings.
        </p>
        <ul className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4">
          {LIBRARY.map((src, k) => {
            const on = photos.some((p) => p.src === src);
            return (
              <li key={src}>
                <button
                  type="button"
                  className={cx(
                    'relative block aspect-[4/3] w-full overflow-hidden rounded border-2',
                    on ? 'border-ink' : 'border-transparent',
                  )}
                  aria-pressed={on}
                  aria-label={'Sample photo ' + (k + 1)}
                  onClick={() => toggleLibrary(src)}
                >
                  <img src={src} alt="" className="img-cover" loading="lazy" />
                  {on && (
                    <span className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
                      <Icon name="check-lg" className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end border-t border-line px-5 py-3">
          <button type="button" className="btn btn-dark" onClick={() => setLibrary(false)}>
            Done
          </button>
        </div>
      </Modal>
    </>
  );
}
