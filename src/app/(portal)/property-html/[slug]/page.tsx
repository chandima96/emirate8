/*
 * The property page without the streamed loading skeleton, for crawlers. next.config.mjs rewrites
 * crawler requests for /property/<slug> here (the URL they see is unchanged), because with loading.tsx
 * the page body arrives in a hidden streamed <div> that crawlers without JavaScript may skip. Same page,
 * same metadata and canonical URL; people still get the skeleton on /property/<slug>.
 */
export { default, generateMetadata } from '../../property/[slug]/page';
