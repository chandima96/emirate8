import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {},
  experimental: {
    globalNotFound: true,
  },
  images: {
    // Property media may be a Supabase Storage URL or a resized data URL.
    unoptimized: true,
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
      beforeFiles: [{ source: '/images/:path*', destination: '/api/media-assets/:path*' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withPayload(nextConfig);
