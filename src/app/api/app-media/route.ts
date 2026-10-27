import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const config = await configPromise;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || user.collection !== 'members') {
    return NextResponse.json({ error: 'Sign in to upload media.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
  }
  const isVideo = ['video/mp4', 'video/webm'].includes(file.type);
  const isSubtitle = /\.(vtt|srt)$/i.test(file.name) && ['text/vtt', 'application/x-subrip', 'text/plain', ''].includes(file.type);
  const allowedType = /^image\/(jpeg|png|webp)$/.test(file.type) || file.type === 'application/pdf' || isVideo || isSubtitle;
  const maxBytes = (isVideo ? 200 : isSubtitle ? 1 : file.type === 'application/pdf' ? 20 : 15) * 1024 * 1024;
  if (!allowedType) return NextResponse.json({ error: 'Upload an image, PDF, MP4, WebM, VTT or SRT file.' }, { status: 400 });
  if (file.size <= 0 || file.size > maxBytes) {
    return NextResponse.json({ error: 'The file is empty or exceeds the upload size limit.' }, { status: 400 });
  }

  const safeName = file.name.replace(/[\\/]/g, '_').slice(-160) || 'upload';
  const sourcePath = `uploads/${randomUUID()}${safeName.match(/\.[a-z0-9]+$/i)?.[0] || ''}`;
  const media = await payload.create({
    collection: 'media',
    data: {
      sourcePath,
      alt: typeof form.get('alt') === 'string' ? String(form.get('alt')).slice(0, 255) : safeName,
    },
    file: {
      name: safeName,
      data: Buffer.from(await file.arrayBuffer()),
      mimetype: isSubtitle ? (/\.vtt$/i.test(file.name) ? 'text/vtt' : 'application/x-subrip') : file.type,
      size: file.size,
    },
    overrideAccess: true,
  });

  if (typeof media.url !== 'string') {
    return NextResponse.json({ error: 'The media upload did not return a storage URL.' }, { status: 500 });
  }
  return NextResponse.json({ id: media.id, url: media.url, filename: media.filename }, { status: 201 });
}
