'use client';

import { useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Lightbox } from '@/components/ui/Lightbox';
import { inertProps, photoItems } from './shared';
import { mediaDisplayURL } from '@/lib/mediaURL';

/** 02 — featured photo first and largest (1 + 4 grid), media buttons, swipe gallery on mobile, lightbox. */
export function Gallery({ listing: l, preview }) {
  const photos = photoItems(l);
  const media = l.media || {};
  const floorplans = (media.floorplans || []).filter((f) => f.mimetype !== 'application/pdf');
  const pdfPlans = (media.floorplans || []).filter((f) => f.mimetype === 'application/pdf');
  const [lb, setLb] = useState(null); // { items, start, title }
  const [idx, setIdx] = useState(0);
  const close = useCallback(() => setLb(null), [setLb]);

  if (!photos.length)
    return (
      <div className="mt-5 flex aspect-[16/7] items-center justify-center rounded-lg border border-dashed border-line bg-white text-[13px] text-muted">
        <Icon name="image" className="mr-2 h-5 w-5" />
        No photos yet
      </div>
    );

  const open = (start) => setLb({ items: photos, start, title: l.title });
  const g = photos.slice(0, 5);
  const extra = photos.length - 5;
  const inert = inertProps(preview);

  return (
    <>
      <div className="pgal mt-5">
        {g.map((p, i) => (
          <button
            key={p.src + i}
            type="button"
            className={'pgal-item' + (i === 0 ? ' pgal-main' : '')}
            onClick={() => open(i)}
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
          >
            <img
              src={mediaDisplayURL(p.src)}
              alt={p.caption || (i === 0 ? l.title : `Photo ${i + 1}`)}
              className="h-full w-full object-cover"
              style={{ objectPosition: (p.focalX ?? 50) + '% ' + (p.focalY ?? 50) + '%' }}
              loading={i ? 'lazy' : undefined}
            />
            {['render', 'construction'].includes(p.imgType) && (
              <span className="absolute top-2 left-2 rounded bg-white/95 px-2 py-1 text-xs text-ink">
                {p.imgType === 'construction' ? 'Construction update' : 'Artist impression'}
              </span>
            )}
            {i === 4 && extra > 0 && <span className="pgal-more">+{extra} photos</span>}
          </button>
        ))}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {l.sample && <span className="demo-tag">Illustrative photos</span>}
        </div>
        <div className="absolute right-3 bottom-3 flex flex-wrap justify-end gap-2">
          {!!floorplans.length && (
            <button
              type="button"
              className="gal-btn"
              onClick={() =>
                setLb({
                  items: floorplans.map((f, i) => ({
                    src: f.src,
                    caption: [f.name || f.caption || `Floor plan ${i + 1}`, f.level].filter(Boolean).join(' \u00b7 '),
                  })),
                  start: 0,
                  title: `${l.title} — floor plans`,
                })
              }
            >
              <Icon name="grid-1x2" className="h-4 w-4" />
              Floor plans
            </button>
          )}
          {pdfPlans.map((f, i) => (
            <a className="gal-btn" key={f.src} href={preview ? '#' : f.src} target="_blank" rel="noopener" {...inert}>
              {[f.name || 'PDF floor plan ' + (i + 1), f.level].filter(Boolean).join(' \u00b7 ')}
            </a>
          ))}
          {(media.videos || []).map((v, i) => (
            <a
              className="gal-btn"
              key={v.id || i}
              href={preview ? '#' : v.url}
              target="_blank"
              rel="noopener"
              {...inert}
            >
              <Icon name="play-circle" />
              {v.title || 'Video ' + (i + 1)}
            </a>
          ))}
          {media.video && (
            <a className="gal-btn" href={preview ? '#' : media.video} target="_blank" rel="noopener" {...inert}>
              <Icon name="play-circle" className="h-4 w-4" />
              Video
            </a>
          )}
          {media.tour && (
            <a className="gal-btn" href={preview ? '#' : media.tour} target="_blank" rel="noopener" {...inert}>
              <Icon name="badge-vr" className="h-4 w-4" />
              Virtual tour
            </a>
          )}
          {media.masterplan && (
            <button
              type="button"
              className="gal-btn"
              onClick={() =>
                setLb({ items: [{ src: media.masterplan, caption: 'Master plan' }], start: 0, title: l.title })
              }
            >
              <Icon name="map" className="h-4 w-4" />
              Master plan
            </button>
          )}
          {media.brochure?.data && (
            <a
              className="gal-btn"
              href={preview ? '#' : media.brochure.data}
              download={preview ? undefined : media.brochure.name}
              {...inert}
            >
              <Icon name="file-earmark-pdf" className="h-4 w-4" />
              Brochure
            </a>
          )}
          <button type="button" className="gal-btn" onClick={() => open(0)}>
            <Icon name="images" className="h-4 w-4" />
            View all {photos.length} photos
          </button>
        </div>
      </div>
      <div className="pgal-mobile mt-4">
        <div
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const t = e.currentTarget;
            setIdx(Math.round(t.scrollLeft / (t.clientWidth || 1)));
          }}
        >
          {photos.map((p, i) => (
            <button
              key={p.src + i}
              type="button"
              className="relative aspect-[4/3] w-full shrink-0 snap-center"
              onClick={() => open(i)}
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
            >
              <img
                src={mediaDisplayURL(p.src)}
                alt=""
                className="h-full w-full object-cover"
                loading={i ? 'lazy' : undefined}
              />
            </button>
          ))}
        </div>
        <span className="photo-count">
          {Math.min(idx, photos.length - 1) + 1} / {photos.length}
        </span>
      </div>
      <Lightbox open={!!lb} items={lb?.items || []} start={lb?.start || 0} title={lb?.title} onClose={close} />
    </>
  );
}
