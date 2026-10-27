'use client';

import { useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { COMMUNITIES } from '@/config/communities';
import { DUBAI_MAP as M } from '@/config/dubai-map';
import { inertProps, locationOf } from './shared';

export const CATS = [
  ['schools', 'Schools', 'mortarboard'],
  ['hospitals', 'Hospitals & clinics', 'hospital'],
  ['shopping', 'Shopping', 'bag'],
  ['restaurants', 'Restaurants & cafés', 'cup-hot'],
  ['transport', 'Public transport', 'train-front'],
  ['parks', 'Parks & beaches', 'tree'],
  ['roads', 'Major roads', 'signpost-split'],
];

const [W, S, E, N] = M.bbox;
const project = (c) => [((c.lng - W) / (E - W)) * M.w, ((N - c.lat) / (N - S)) * M.h];

/** Static SVG layers: sea pattern, Dubai outline, other communities, approximate pin for this community. */
function MapLayers({ area }) {
  const c = COMMUNITIES[area];
  const pin = c ? project(c) : null;
  return (
    <>
      <rect x="-2000" y="-2000" width="5000" height="5000" fill="url(#sea-l)" />
      <path d={M.d} fill="#FFFFFF" stroke="#142326" strokeWidth="1.1" strokeLinejoin="round" />
      {Object.keys(COMMUNITIES)
        .filter((k) => k !== area)
        .map((k) => {
          const [x, y] = project(COMMUNITIES[k]);
          return (
            <circle key={k} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.5" fill="#A9C0AF">
              <title>{k}</title>
            </circle>
          );
        })}
      {pin && (
        <g transform={`translate(${pin[0].toFixed(1)} ${pin[1].toFixed(1)})`}>
          <circle r="34" fill="#142326" fillOpacity=".08" stroke="#142326" strokeOpacity=".3" strokeDasharray="3 3" />
          <circle r="9" fill="#142326" stroke="#fff" strokeWidth="3" />
          <text
            y="-44"
            textAnchor="middle"
            fontFamily="Instrument Sans, sans-serif"
            fontSize="15"
            fontWeight="600"
            fill="#142326"
            paintOrder="stroke"
            stroke="#F7F7F3"
            strokeWidth="4"
          >
            {area}
          </text>
        </g>
      )}
    </>
  );
}

/** Zoomable / draggable demonstration map — community-level position only, never the exact property. */
function MapCanvas({ area }) {
  const c = COMMUNITIES[area];
  const start = c ? project(c) : [M.w / 2, M.h / 2];
  const [view, setView] = useState({ cx: start[0], cy: start[1], z: 2.4 });
  const drag = useRef(null);
  const svgRef = useRef(null);
  const layers = useMemo(() => <MapLayers area={area} />, [area]);
  const { cx, cy, z } = view;
  const tx = M.w / 2 - cx * z;
  const ty = M.h / 2 - cy * z;
  const zoom = (dir) => setView((v) => ({ ...v, z: Math.max(1, Math.min(6, v.z * (dir === 'in' ? 1.4 : 1 / 1.4))) }));

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${M.w} ${M.h}`}
        className="block h-full w-full"
        role="img"
        aria-label={`Map of Dubai with the approximate location of ${area}`}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, cx, cy };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const k = M.w / svgRef.current.getBoundingClientRect().width / z;
          setView({ z, cx: d.cx - (e.clientX - d.x) * k, cy: d.cy - (e.clientY - d.y) * k });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <defs>
          <pattern id="sea-l" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 10 L10 0" stroke="#DCE2DE" strokeWidth=".7" />
          </pattern>
        </defs>
        <g transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${z})`}>{layers}</g>
      </svg>
      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded border border-line bg-white shadow-card">
        <button type="button" className="map-z" onClick={() => zoom('in')} aria-label="Zoom in">
          <Icon name="plus-lg" />
        </button>
        <button type="button" className="map-z border-t border-line" onClick={() => zoom('out')} aria-label="Zoom out">
          <Icon name="dash-lg" />
        </button>
      </div>
      <span className="absolute bottom-3 left-3 max-w-[78%] rounded-sm bg-white/95 px-2 py-1 text-2xs leading-[1.4] text-muted shadow-card">
        Demonstration map · approximate community location, not the exact property position ·{' '}
        <span data-map-zoom-level>{Math.round(z * 100)}%</span>
      </span>
    </>
  );
}

/** 06 — Location: nearby categories + demonstration map. */
export function DemoMap({ listing: l, preview }) {
  const c = COMMUNITIES[l.area];
  const [cat, setCat] = useState(CATS[0][0]);
  const active = CATS.find((k) => k[0] === cat) || CATS[0];
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((l.area || '') + ', Dubai')}`;

  return (
    <section id="location" className="mt-12 scroll-mt-24" aria-labelledby="h-loc">
      <h2 id="h-loc" className="h3">
        Location
      </h2>
      <p className="mt-1 text-[14px] text-text">{locationOf(l)}</p>
      {c && <p className="mt-1 text-[13px] text-muted">Nearby: {CATS.map((k) => k[1].toLowerCase()).join(', ')}.</p>}
      <div className="mt-4 grid overflow-hidden rounded-lg border border-line bg-white lg:grid-cols-[280px_1fr]">
        <div className="border-b border-line p-4 lg:border-r lg:border-b-0">
          <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">Categories</p>
          {c ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-1 lg:grid-cols-1" role="group" aria-label="Nearby categories">
                {CATS.map(([key, name, icon]) => (
                  <button
                    key={key}
                    type="button"
                    className="map-cat"
                    aria-pressed={cat === key}
                    onClick={() => setCat(key)}
                  >
                    <Icon name={icon} className="h-4 w-4" />
                    <span>{name}</span>
                    <Icon name="chevron-right" className="ml-auto hidden h-3 w-3 lg:inline-flex" />
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded bg-paper p-3" aria-live="polite">
                <p className="text-[13px] font-semibold text-ink">{active[1]}</p>
                <p className="mt-1 text-[13px] leading-[1.55] text-text">{c.nearby[active[0]] || ''}</p>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-muted">
              Neighbourhood information isn’t available for this community yet.
            </p>
          )}
        </div>
        <div className="relative min-h-[320px] overflow-hidden bg-paper sm:min-h-[420px]">
          <MapCanvas key={l.area || ''} area={l.area} />
          <a
            className="absolute right-3 bottom-3 rounded-sm bg-white/95 px-2 py-1 text-2xs font-semibold text-ink shadow-card hover:underline"
            href={preview ? '#' : gmaps}
            target="_blank"
            rel="noopener"
            {...inertProps(preview)}
          >
            Open in Google Maps
          </a>
        </div>
      </div>
      <p className="mt-2 text-2xs text-muted">
        Map outline © OpenStreetMap contributors. Nearby information is general and may change — check current
        facilities before relying on it.
      </p>
    </section>
  );
}
