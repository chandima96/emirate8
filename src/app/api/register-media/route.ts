import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Choose a document to upload.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a document to upload.' }, { status: 400 });
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))
    return NextResponse.json({ error: 'Upload a PDF, JPG or PNG file.' }, { status: 400 });
  if (file.size <= 0 || file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: 'The document must be smaller than 10 MB.' }, { status: 400 });

  const config = await configPromise;
  const payload = await getPayload({ config });
  const safeName = file.name.replace(/[\\/]/g, '_').slice(-160) || 'registration-evidence';
  const sourcePath = `registration-evidence/${randomUUID()}${safeName.match(/\.[a-z0-9]+$/i)?.[0] || ''}`;
  const media: any = await payload.create({
    collection: 'media',
    overrideAccess: true,
    data: { sourcePath, alt: safeName },
    file: { name: safeName, data: Buffer.from(await file.arrayBuffer()), mimetype: file.type, size: file.size },
  });
  if (typeof media.url !== 'string')
    return NextResponse.json({ error: 'The upload did not return a document URL.' }, { status: 500 });
  return NextResponse.json(
    { id: media.id, url: media.url, filename: media.filename, mimetype: file.type },
    { status: 201 },
  );
}
