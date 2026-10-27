/* Image paths for photography in /public/images (see /public/images/credits.json). */
export const IMG = '/images/';
export const PIMG = IMG + 'property-images/';

const ROOT_IMAGES =
  /^(hero-dubai|dubai-marina|palm-jumeirah|business-bay|dubai-hills|downtown-dubai|downtown-aerial|cta-dubai-dusk)$/;

export function im(name) {
  return (ROOT_IMAGES.test(name) ? IMG : PIMG) + name + '.webp';
}
