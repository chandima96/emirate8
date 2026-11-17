/* Building / project catalogue derived from published Emirate08 listings.
 *
 * Portals such as Property Finder and Bayut let agents pick a building and inherit its community, developer,
 * map pin and building facts. Until a curated DLD/ADREC building register is connected, the catalogue is
 * built from listings already published on the platform. Only building-level facts are exposed — never unit
 * numbers, exact floors, owners or private answers — and listings whose public location is "approximate"
 * are excluded because their building is not public.
 */
import { listingSchema as S } from '@/components/listings/editor/designer-schema';

const U = S.util;

export type CatalogueUnitType = {
  ptype: string;
  bedrooms: string;
  bathrooms: string;
  layoutCode: string;
  areaFrom: number | null;
  areaTo: number | null;
  priceFrom: number | null;
  floorPlan: string;
};

export type CatalogueProject = {
  developer: string;
  stage: string;
  handoverQ: string;
  handoverY: string;
  handoverDate: string;
  progressPct: string;
  progressDate: string;
  progressSource: string;
  startingPrice: number | null;
  milestones: { name: string; mode: string; value: string; trigger: string; when: string }[];
  unitTypes: CatalogueUnitType[];
  fromDeveloper: boolean;
};

export type CatalogueBuilding = {
  key: string;
  name: string;
  emirate: string;
  community: string;
  subcommunity: string;
  tower: string;
  developer: string;
  masterDeveloper: string;
  lat: string;
  lng: string;
  completionYear: string;
  tenure: string;
  totalFloors: string;
  serviceChargePerSqft: number | null;
  cooling: string;
  pets: string;
  sharedAmenities: string[];
  listingCount: number;
  project: CatalogueProject | null;
};

export function catalogueKey(emirate: string, community: string, name: string) {
  return [emirate, community, name].map((part) => U.norm(U.trim1(part))).join('|');
}

/** Most frequent non-blank value (ties keep the first seen, i.e. the most recently updated listing). */
function mode(values: unknown[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const text = U.trim1(value == null ? '' : String(value));
    if (text) counts.set(text, (counts.get(text) || 0) + 1);
  }
  let best = '';
  let top = 0;
  for (const [value, count] of counts) if (count > top) [best, top] = [value, count];
  return best;
}

function median(values: number[], positiveOnly = true) {
  const sorted = values.filter((n) => Number.isFinite(n) && (!positiveOnly || n > 0)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sqft(value: any) {
  if (!value || typeof value !== 'object') return null;
  const n = U.areaIn(value, 'sqft');
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function money(value: unknown) {
  const fils = U.parseMoney(value);
  return fils == null || isNaN(fils) || fils <= 0 ? null : fils / 100;
}

/** Turns stored property documents (Payload docs or workspace listings) into catalogue buildings. */
export function buildCatalogue(docs: any[]): CatalogueBuilding[] {
  const groups = new Map<string, { rows: any[] }>();
  for (const doc of docs) {
    const listing = doc?.appData && typeof doc.appData === 'object' ? { ...doc.appData, ...doc, appData: undefined } : doc;
    const editor = doc?.appData?.editor || doc?.editor;
    const d = editor?.d;
    if (!d) continue;
    const name = U.trim1(d.proposing ? '' : d.buildingName);
    const community = U.trim1(d.communityId);
    if (!name || !community || d.locPrecision === 'approximate') continue;
    const key = catalogueKey(d.emirate || 'Dubai', community, name);
    if (!groups.has(key)) groups.set(key, { rows: [] });
    groups.get(key)!.rows.push({ listing, editor, d });
  }

  const out: CatalogueBuilding[] = [];
  for (const [key, { rows }] of groups) {
    const ds = rows.map((r) => r.d);
    const ready = rows.filter((r) => r.d.devStatus === 'ready');
    const off = rows.filter((r) => r.d.devStatus === 'offplan');
    // Shared facilities selected on at least half of the building's listings.
    const amenityCounts = new Map<string, number>();
    for (const r of rows)
      for (const [id, a] of Object.entries<any>(r.editor.amen || {})) {
        const def = S.AMENITY[id];
        if (a?.selected === false || !def || (def.group !== 'shared' && def.group !== 'services')) continue;
        amenityCounts.set(id, (amenityCounts.get(id) || 0) + 1);
      }
    const sharedAmenities = [...amenityCounts]
      .filter(([, count]) => count * 2 >= rows.length)
      .map(([id]) => id);

    const perSqft = rows.flatMap((r) => {
      const fils = U.parseMoney(r.d.serviceCharge);
      if (fils == null || isNaN(fils) || fils <= 0) return [];
      if (r.d.serviceBasis === 'per_sqft') return [fils / 100];
      const area = sqft(r.d.unitArea) || sqft(r.d.builtUpArea);
      return r.d.serviceBasis === 'per_year' && area ? [fils / 100 / area] : [];
    });
    const coord = (value: unknown) => {
      const n = U.parseDec(value);
      return n == null || isNaN(n) ? [] : [n];
    };
    const pinned = rows.filter((r) => coord(r.d.lat).length && coord(r.d.lng).length);
    const lats = pinned.flatMap((r) => coord(r.d.lat));
    const lngs = pinned.flatMap((r) => coord(r.d.lng));
    const floors = ds.map((d) => U.parseIntSafe(d.totalFloors)).filter((n) => n != null && !isNaN(n)) as number[];

    let project: CatalogueProject | null = null;
    if (off.length) {
      // Prefer the developer's own listings for project facts; fall back to broker listings.
      const dev = off.filter((r) => r.listing.ownerType === 'developer');
      const source = dev.length ? dev : off;
      const sd = source.map((r) => r.d);
      const latest = source[0];
      const units = new Map<string, CatalogueUnitType>();
      for (const r of off) {
        const d = r.d;
        const unitKey = [d.ptype, d.bedrooms, d.layoutCode].join('|');
        const area = sqft(d.unitArea) || sqft(d.builtUpArea);
        const areaMax = d.unitArea?.rawMax ? sqft({ raw: d.unitArea.rawMax, unit: d.unitArea.unit }) : null;
        const price = money(d.txn === 'initial' ? d.unitPrice : d.askingPrice);
        const plan = (r.listing.media?.floorplans || []).find((p: any) => p?.src && /^https?:|^\//.test(p.src));
        const prev = units.get(unitKey);
        const lo = [prev?.areaFrom, area].filter((n): n is number => n != null);
        const hi = [prev?.areaTo, areaMax || area].filter((n): n is number => n != null);
        const prices = [prev?.priceFrom, d.txn === 'initial' ? price : null].filter((n): n is number => n != null);
        units.set(unitKey, {
          ptype: d.ptype || '',
          bedrooms: d.bedrooms || prev?.bedrooms || '',
          bathrooms: prev?.bathrooms || d.bathrooms || '',
          layoutCode: d.layoutCode || prev?.layoutCode || '',
          areaFrom: lo.length ? Math.min(...lo) : null,
          areaTo: hi.length ? Math.max(...hi) : null,
          priceFrom: prices.length ? Math.min(...prices) : null,
          floorPlan: prev?.floorPlan || plan?.src || '',
        });
      }
      const initialPrices = off
        .map((r) => (r.d.txn === 'initial' ? money(r.d.unitPrice) : null))
        .filter((n): n is number => n != null);
      project = {
        developer: mode(sd.map((d) => d.developer)),
        stage: mode(sd.map((d) => d.stage)),
        handoverQ: mode(sd.map((d) => d.handoverQ)),
        handoverY: mode(sd.map((d) => d.handoverY)),
        handoverDate: mode(sd.map((d) => d.handoverDate)),
        progressPct: latest.d.progressPct || '',
        progressDate: latest.d.progressDate || '',
        progressSource: latest.d.progressSource || '',
        startingPrice: initialPrices.length ? Math.min(...initialPrices) : null,
        milestones: (source.find((r) => (r.editor.milestones || []).length)?.editor.milestones || []).map((m: any) => ({
          name: String(m.name || ''),
          mode: m.mode === 'aed' ? 'aed' : 'pct',
          value: String(m.value || ''),
          trigger: String(m.trigger || ''),
          when: String(m.when || ''),
        })),
        unitTypes: [...units.values()].sort((a, b) => (a.areaFrom || 0) - (b.areaFrom || 0)),
        fromDeveloper: dev.length > 0,
      };
    }

    out.push({
      key,
      name: mode(ds.map((d) => d.buildingName)),
      emirate: mode(ds.map((d) => d.emirate)) || 'Dubai',
      community: mode(ds.map((d) => d.communityId)),
      subcommunity: mode(ds.map((d) => d.subcommunity)),
      tower: mode(ds.map((d) => d.tower)),
      developer: mode(ds.map((d) => d.developer)),
      masterDeveloper: mode(ds.map((d) => d.masterDeveloper)),
      lat: lats.length ? String(median(lats, false)) : '',
      lng: lngs.length ? String(median(lngs, false)) : '',
      completionYear: mode(ready.map((r) => r.d.completionYear)),
      tenure: mode(ds.map((d) => (d.tenure === 'unknown' ? '' : d.tenure))),
      totalFloors: floors.length ? String(Math.max(...floors)) : '',
      serviceChargePerSqft: perSqft.length ? Math.round(median(perSqft)! * 100) / 100 : null,
      cooling: mode(ds.map((d) => (d.cooling === 'unknown' ? '' : d.cooling))),
      pets: mode(ds.map((d) => (d.pets === 'unknown' ? '' : d.pets))),
      sharedAmenities,
      listingCount: rows.length,
      project,
    });
  }
  return out.sort((a, b) => b.listingCount - a.listingCount || a.name.localeCompare(b.name));
}

/** Ranks catalogue buildings for a typed query (name, tower, subcommunity or community). */
export function searchCatalogue(buildings: CatalogueBuilding[], query: string, emirate = '', limit = 8) {
  const q = U.norm(query);
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  return buildings
    .filter((b) => !emirate || b.emirate === emirate)
    .map((b) => {
      const name = U.norm(b.name);
      const hay = [b.name, b.tower, b.subcommunity, b.community, b.developer].map(U.norm).join(' ');
      if (!words.every((w) => hay.includes(w))) return null;
      const score = (name.startsWith(q) ? 3 : name.includes(q) ? 2 : 1) + Math.min(b.listingCount, 20) / 100;
      return { b, score };
    })
    .filter((x): x is { b: CatalogueBuilding; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.b);
}
