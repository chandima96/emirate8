import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

/** Private areas no crawler should index. */
const PRIVATE = [
  '/dashboard',
  '/agency-dashboard',
  '/developer-dashboard',
  '/account',
  '/control-room',
  '/api/',
  '/login',
  '/register',
  '/saved',
  '/brokers/me',
  // Internal crawler copy of /property/<slug> (reached by rewrite, never linked).
  '/property-html/',
];

/*
 * Search engines plus the AI search and assistant crawlers that fetch pages to answer and cite them.
 * They are named explicitly so the policy is visible and can change per bot. A bot that matches a
 * named group ignores the `*` group, so each group repeats the private paths.
 */
const SEARCH_AND_ASSISTANT_BOTS = [
  'Googlebot',
  'Bingbot',
  'Applebot',
  'DuckDuckBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
];

/*
 * Crawlers that collect model training data (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended,
 * CCBot, …) fall under `*` and are allowed, as before. To opt out of training, add a group for them
 * with `disallow: '/'`; that does not affect the search and assistant bots above.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: SEARCH_AND_ASSISTANT_BOTS, allow: '/', disallow: PRIVATE },
      { userAgent: '*', allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
