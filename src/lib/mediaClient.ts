'use client';

export type UploadedMedia = { id: string | number; url: string; filename: string };

export async function uploadMediaFile(file: Blob, filename: string, alt = filename): Promise<UploadedMedia> {
  const form = new FormData();
  form.append('file', file, filename);
  form.append('alt', alt);
  const response = await fetch('/api/app-media', { method: 'POST', body: form, credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not upload media.');
  return result as UploadedMedia;
}

export async function uploadMediaDataURL(dataURL: string, filename: string, alt = filename) {
  const response = await fetch(dataURL);
  if (!response.ok) throw new Error('Could not prepare this image for upload.');
  const blob = await response.blob();
  const uploadedName = filename.replace(/\.[^.]+$/, '') + (blob.type === 'image/png' ? '.png' : '.jpg');
  return uploadMediaFile(blob, uploadedName, alt);
}

export async function uploadRegistrationEvidence(file: Blob, filename: string) {
  const form = new FormData();
  form.append('file', file, filename);
  const response = await fetch('/api/register-media', { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not upload registration evidence.');
  return result as UploadedMedia & { mimetype: string };
}
