import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Media } from '../src/collections/Media';
import { getBundledMediaPath } from '../src/lib/server/bundledMedia';
import { mediaDisplayURL } from '../src/lib/mediaURL';

test('bundled image lookup rejects paths outside the image directory', async () => {
  for (const value of ['../.env', '..\\.env', '/.env', 'a/../../.env', '', undefined]) {
    assert.equal(await getBundledMediaPath(value), null);
  }
  assert.ok(await getBundledMediaPath('business-bay.webp'));
  assert.equal(await getBundledMediaPath('missing-file.webp'), null);
});

test('media documents use bundled images for public and admin previews', async () => {
  const hook = Media.hooks!.afterRead![0];
  const doc = { sourcePath: 'business-bay.webp', url: 'https://storage.invalid/missing.webp' };
  const result = await hook({ doc } as Parameters<typeof hook>[0]);
  assert.equal(result.url, '/api/media-assets/business-bay.webp');
  assert.equal(result.thumbnailURL, result.url);
  const uploaded = { sourcePath: 'uploads/missing.jpg', url: 'https://storage.example/upload.jpg' };
  assert.equal((await hook({ doc: uploaded } as Parameters<typeof hook>[0])).url, uploaded.url);
});

test('image display URLs bypass cached redirects and preserve upload URLs', () => {
  assert.equal(mediaDisplayURL('/images/downtown-dubai.webp'), '/api/media-assets/downtown-dubai.webp');
  assert.equal(mediaDisplayURL('/images/property-images/int-kitchen-1.webp'), '/api/media-assets/property-images/int-kitchen-1.webp');
  for (const src of ['https://storage.example/photo.jpg', 'data:image/png;base64,abc', '/api/media-assets/photo.webp', '']) {
    assert.equal(mediaDisplayURL(src), src);
  }
});

test('media documents retain uploaded storage URLs when S3 is configured', async () => {
  const previous = process.env.S3_PUBLIC_URL;
  process.env.S3_PUBLIC_URL = 'https://storage.example/media';
  try {
    const hook = Media.hooks!.afterRead![0];
    const doc = { sourcePath: 'business-bay.webp', url: 'https://storage.example/media/business-bay.webp' };
    assert.equal((await hook({ doc } as Parameters<typeof hook>[0])).url, doc.url);
  } finally {
    if (previous === undefined) delete process.env.S3_PUBLIC_URL;
    else process.env.S3_PUBLIC_URL = previous;
  }
});
