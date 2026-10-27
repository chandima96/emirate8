/** Inspect the original image before resizing, so duplicate and quality checks use the source file. */
export function photoQuality(width, height) {
  return { width, height, lowResolution: width < 1280 || height < 720 };
}

export async function photoHash(file) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function inspectPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error(file.name + ' must be a JPG, PNG or WebP image.');
  if (!file.size || file.size > 15 * 1048576) throw new Error(file.name + ' must be a non-empty image under 15 MB.');
  const hash = await photoHash(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { hash, ...photoQuality(image.naturalWidth, image.naturalHeight) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
