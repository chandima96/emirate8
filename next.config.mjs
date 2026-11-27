import { createRequire } from 'node:module';
import { withPayload } from '@payloadcms/next/withPayload';

/*
 * Bots that get one complete HTML document instead of a streamed response. Streaming sends loading.tsx
 * skeletons first and the real page later in a hidden <div> swapped in by JavaScript, which crawlers
 * that don't run JavaScript may never read. Next.js's default list covers search and link-preview bots
 * but not AI crawlers, so they are added here; browsers keep the streamed loading skeletons.
 */
const require = createRequire(import.meta.url);
let nextDefaultBots;
try {
  nextDefaultBots = require('next/dist/shared/lib/router/utils/html-bots.js').HTML_LIMITED_BOT_UA_RE.source;
} catch {
  // Copy of the Next.js 16.4 default, in case the internal module moves in a later release.
  nextDefaultBots =
    '[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight';
}
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
  'Amazonbot',
  'meta-externalagent',
  'DuckAssistBot',
  'MistralAI-User',
  'cohere-ai',
  // Our own SEO content agent (src/lib/server/seoAgent): it audits pages as crawlers receive them.
  'Emirate08-SEO-agent',
];

/*
 * Crawlers that read HTML without running JavaScript (plus search engines, which gain nothing from the
 * skeleton) are served /property/<slug> from /property-html/<slug>: the same page without loading.tsx,
 * so the listing is in the HTML instead of a hidden streamed chunk. Matched on the User-Agent header,
 * so the rule is never evaluated as a page for ordinary visitors.
 */
const CRAWLER_UA =
  '.*(' +
  [
    ...AI_CRAWLERS,
    'Googlebot',
    'bingbot',
    'Bingbot',
    'DuckDuckBot',
    'Applebot',
    'YandexBot',
    'Baiduspider',
    'facebookexternalhit',
    'Twitterbot',
    'LinkedInBot',
    'Slackbot',
    'WhatsApp',
    'Discordbot',
  ].join('|') +
  ').*';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  htmlLimitedBots: new RegExp([nextDefaultBots, ...AI_CRAWLERS].join('|'), 'i'),
  turbopack: {},
  experimental: {
    globalNotFound: true,
  },
  images: {
    // Property media may be a Supabase Storage URL or a resized data URL.
    unoptimized: true,
  },
  // The enquiry form partner websites embed (src/app/(standalone)/embed) may be framed by any site;
  // it is kept out of search results because the property page is the canonical listing.
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  // Legacy .html links from the static build keep working.
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/agent.html', destination: '/agents', permanent: false },
      { source: '/property.html', destination: '/properties', permanent: false },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/images/:path*', destination: '/api/media-assets/:path*' },
        {
          source: '/property/:slug',
          has: [{ type: 'header', key: 'user-agent', value: CRAWLER_UA }],
          destination: '/property-html/:slug',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withPayload(nextConfig);
