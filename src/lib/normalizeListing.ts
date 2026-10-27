import { LEGACY_STATUS } from '../config/reference';

/** Pure listing normalisation shared by the browser store and standalone seed scripts. */
export function normalize(l: any) {
  if (!l) return l;
  if (LEGACY_STATUS[l.status]) l.status = LEGACY_STATUS[l.status];
  if (!l.photos) l.photos = (l.images || []).map((src: string) => ({ src, caption: '' }));
  const sources = (l.photos || []).map((photo: any) => photo.src).filter(Boolean);
  if (!l.featured || !sources.includes(l.featured)) l.featured = sources[0] || '';
  l.images = l.featured ? [l.featured, ...sources.filter((src: string) => src !== l.featured)] : sources;
  l.display = l.display || { visible: true, portfolioFeatured: false, contact: 'any' };
  l.media = l.media || {};
  l.media.floorplans = l.media.floorplans || [];
  l.highlights = l.highlights || [];
  l.amenities = l.amenities || [];
  l.completion = l.completion || 'ready';
  if (l.completion === 'offplan') {
    l.purpose = 'sale';
    l.offplan = l.offplan || { plan: [] };
    l.offplan.plan = l.offplan.plan || [];
    l.handover = l.offplan.handover || l.handover || '';
  }
  l.slug = l.slug || l.id;
  l.available = l.status === 'published' && l.display.visible !== false;
  l.listed = Math.max(0, Math.round((Date.now() - new Date(l.createdAt || Date.now()).getTime()) / 864e5));
  l.permitStatus = l.permit && l.permit.number ? (l.sample || /^SAMPLE/.test(l.permit.number) ? 'verified' : 'pending') : 'missing';
  return l;
}
