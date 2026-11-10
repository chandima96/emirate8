import { NextResponse } from 'next/server';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { readFile } from 'node:fs/promises';
import { getBundledMediaPath } from '@/lib/server/bundledMedia';

export const revalidate = 3600;

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { path } = await params;
  const sourcePath = path.join('/');
  if (!sourcePath || sourcePath.split('/').some((part) => !part || part === '.' || part === '..')) {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }

  // Serve bundled files directly. Looking up every bundled image in Payload
  // adds a database round trip to common page assets and can redirect back to
  // the same image through storage.
  const bundledPath = await getBundledMediaPath(sourcePath);
  if (bundledPath) {
    const contentTypes: Record<string, string> = {
      webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif',
    };
    return new NextResponse(await readFile(bundledPath), {
      headers: {
        'Content-Type': contentTypes[sourcePath.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  }

  // Legacy paths for files that are not bundled resolve to their uploaded Media records.
  const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/+$/, '');
  if (publicBase) {
    const config = await configPromise;
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: 'media',
      where: { sourcePath: { equals: sourcePath } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const url = result.docs[0]?.url;
    if (typeof url === 'string' && url.startsWith(`${publicBase}/`)) {
      return NextResponse.redirect(url, { status: 307, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
}
