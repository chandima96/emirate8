'use client';

import { useState } from 'react';
import { Field } from '@/components/ui/Field';
import { uploadMediaFile } from '@/lib/mediaClient';
import { uid } from '@/lib/utils';
import { listingSchema as S } from './designer-schema';

export function VideoManager({ ed }) {
  const [uploading, setUploading] = useState(false);
  const rows = ed.L.media.videos || [];
  const set = (next) => ed.set('media.videos', next);
  const change = (id, key, value) => set(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  async function upload(file) {
    if (!file) return;
    if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 200 * 1048576) {
      ed.toast('Choose an MP4 or WebM video under 200 MB.');
      return;
    }
    setUploading(true);
    try {
      const media = await uploadMediaFile(file, file.name, file.name);
      const latest = ed.latest().media.videos || [];
      if (latest.length < 3)
        ed.set('media.videos', [
          ...latest,
          {
            id: uid('video'),
            title: file.name.replace(/\.[^.]+$/, ''),
            kind: 'file',
            url: media.url,
            mediaId: media.id,
            size: file.size,
            mimetype: file.type,
          },
        ]);
    } catch (e) {
      ed.toast(e instanceof Error ? e.message : 'Video upload failed.');
    } finally {
      setUploading(false);
    }
  }
  async function attachment(row, key, file) {
    if (!file) return;
    const valid =
      key === 'poster'
        ? /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 5 * 1048576
        : /\.(vtt|srt)$/i.test(file.name) && file.size <= 1048576;
    if (!valid) {
      ed.toast(
        key === 'poster'
          ? 'Choose a JPG, PNG or WebP poster under 5 MB.'
          : 'Choose a VTT or SRT subtitle file under 1 MB.',
      );
      return;
    }
    try {
      const media = await uploadMediaFile(file, file.name, file.name);
      change(row.id, key, { ...media, name: file.name });
    } catch (e) {
      ed.toast(e instanceof Error ? e.message : 'Attachment upload failed.');
    }
  }
  return (
    <div className="mt-7 border-t border-line pt-5" id="designer-videos" tabIndex={-1}>
      <h3 className="h4">Videos</h3>
      <p className="mt-1 text-xs text-muted">
        Up to 3 uploaded videos or YouTube / Vimeo links. MP4 or WebM · 200 MB maximum each.
      </p>
      <div className="mt-3 space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={'video-title-' + r.id} label="Video title">
                <input
                  id={'video-title-' + r.id}
                  className="input"
                  maxLength={120}
                  value={r.title || ''}
                  onChange={(e) => change(r.id, 'title', e.target.value)}
                />
              </Field>
              <Field id={'video-type-' + r.id} label="Video type">
                <select
                  id={'video-type-' + r.id}
                  className="select"
                  value={r.videoType || 'walkthrough'}
                  onChange={(e) => change(r.id, 'videoType', e.target.value)}
                >
                  <option value="walkthrough">Actual property walkthrough</option>
                  <option value="show_unit">Show unit</option>
                  <option value="promo">Developer promotional video</option>
                  <option value="construction">Construction update</option>
                </select>
              </Field>
              {r.kind === 'link' ? (
                <Field id={'video-url-' + r.id} label="YouTube / Vimeo URL">
                  <input
                    id={'video-url-' + r.id}
                    className="input"
                    type="url"
                    value={r.url || ''}
                    onChange={(e) => change(r.id, 'url', e.target.value)}
                  />
                </Field>
              ) : (
                <video
                  className="max-h-48 w-full rounded"
                  controls
                  preload="metadata"
                  src={r.url}
                  poster={r.poster?.url}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (!r.duration)
                      change(r.id, 'duration', { seconds: v.duration, width: v.videoWidth, height: v.videoHeight });
                  }}
                  onError={() => ed.toast('This browser could not play the video. Try an H.264 MP4 or VP9 WebM file.')}
                />
              )}
            </div>
            {r.duration && (
              <p className="mt-2 text-xs text-muted">
                {S.util.fmtDur(r.duration.seconds)} · {r.duration.width} × {r.duration.height} ·{' '}
                {r.duration.width >= r.duration.height ? 'Landscape' : 'Portrait'}
                {r.size ? ' · ' + S.util.fmtBytes(r.size) : ''}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {[
                ['poster', 'Poster image', 'image/jpeg,image/png,image/webp'],
                ['subtitles', 'Subtitles', '.vtt,.srt'],
              ].map(([key, label, accept]) => (
                <label key={key} className="btn btn-outline btn-sm cursor-pointer">
                  {r[key]?.name || label}
                  <input
                    className="sr-only"
                    aria-label={label + ' for ' + (r.title || 'video')}
                    type="file"
                    accept={accept}
                    onChange={(e) => {
                      void attachment(r, key, e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm text-danger"
                onClick={() => set(rows.filter((v) => v.id !== r.id))}
              >
                Remove video
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <label className="btn btn-outline btn-sm cursor-pointer">
          <span>{uploading ? 'Uploading video…' : 'Upload video'}</span>
          <input
            type="file"
            className="sr-only"
            accept="video/mp4,video/webm"
            disabled={uploading || rows.length >= 3}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={rows.length >= 3}
          onClick={() => set([...rows, { id: uid('video'), kind: 'link', title: '', url: '' }])}
        >
          Add video link
        </button>
      </div>
      {ed.errors.videos && <p className="err mt-2">{ed.errors.videos}</p>}
    </div>
  );
}
