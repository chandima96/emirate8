import { DUBAI_MAP } from '@/config/dubai-map';

/* Label placement per community (old build.py dubai_map_svg meta): [label, anchor, dx, dy]. */
const META = {
  downtown: ['Downtown Dubai', 'end', -14, -10],
  businessbay: ['Business Bay', 'start', 14, 18],
  marina: ['Dubai Marina', 'start', 14, 5],
  palm: ['Palm Jumeirah', 'end', -14, -8],
  hills: ['Dubai Hills Estate', 'start', 14, 5],
};
const ORDER = ['downtown', 'marina', 'palm', 'businessbay', 'hills'];

const { w, h, bbox, d, pins } = DUBAI_MAP;
const [W, S, E, N] = bbox;
const kx = Math.cos((((S + N) / 2) * Math.PI) / 180);
const scale = w / ((E - W) * kx);
const bar = (5 * scale) / 111.32; // 5 km in px at this latitude
const H = h.toFixed(0);

/** Demonstration map of central Dubai with five selectable community pins (same SVG as the old static build). */
export function DubaiMap({ active, onSelect }) {
  return (
    <svg
      viewBox={`0 0 ${w} ${H}`}
      className="block h-auto w-full"
      role="group"
      aria-label="Map of central Dubai showing five communities"
      data-map-svg
    >
      <defs>
        <path id="dubai-land" d={d} />
        <pattern id="sea-lines" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 10 L10 0" stroke="#DCE2DE" strokeWidth=".7" />
        </pattern>
      </defs>
      <rect width={w} height={H} fill="url(#sea-lines)" />
      <use href="#dubai-land" fill="#FFFFFF" data-map-land />
      <path d={d} fill="none" stroke="#142326" strokeWidth="1.1" strokeLinejoin="round" data-map-outline />
      <text x="120" y="420" fill="#6A7472" fontSize="13" letterSpacing="4" fontFamily="Instrument Sans, sans-serif">
        ARABIAN GULF
      </text>
      <g transform={`translate(${w - 70} 40)`} fill="#142326" fontFamily="Instrument Sans, sans-serif">
        <path d="M0 -18 L7 6 L0 1 L-7 6 Z" />
        <text y="26" textAnchor="middle" fontSize="12" fontWeight="600">
          N
        </text>
      </g>
      <g
        transform={`translate(${(w - 40 - bar).toFixed(1)} ${(h - 36).toFixed(0)})`}
        fontFamily="Instrument Sans, sans-serif"
        fontSize="11"
        fill="#6A7472"
      >
        <rect width={bar.toFixed(1)} height="3" fill="#142326" />
        <text y="18">0</text>
        <text x={bar.toFixed(1)} y="18" textAnchor="end">
          5 km
        </text>
      </g>
      {ORDER.map((k) => {
        const [x, y] = pins[k];
        const [label, anchor, dx, dy] = META[k];
        const tw = label.length * 7.4 + 20;
        const hx = anchor === 'end' ? -tw - 6 : -20;
        const on = active === k;
        return (
          <g
            key={k}
            className={'map-pin' + (on ? ' is-active' : '')}
            data-pin={k}
            tabIndex={0}
            role="button"
            aria-label={'Show ' + label}
            aria-pressed={on}
            transform={`translate(${x} ${y})`}
            onClick={() => onSelect(k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(k);
              }
            }}
          >
            <rect
              x={hx.toFixed(0)}
              y="-20"
              width={(tw + 26).toFixed(0)}
              height={Math.max(40, Math.abs(dy) + 32)}
              fill="transparent"
            />
            <g className="pin-inner">
              <circle className="pin-ring" r="16" strokeWidth="1.5" />
              <circle className="pin-core" r="6.5" />
              <text x={dx} y={dy} textAnchor={anchor}>
                {label}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
