import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPublicUrl, extractImageUrls, extractPagePhotos, htmlToText, isPrivateAddress, sniffImageType, unwrapImageUrl } from '../src/lib/listingImagesServer';

const page = 'https://www.example-portal.com/property/123';

test('photos come from og:image, JSON-LD, img srcset and embedded gallery JSON, without site furniture', () => {
  const html = `
    <meta property="og:image" content="https://cdn.example-portal.com/listing/123/main.jpg">
    <script type="application/ld+json">{"@type":"Residence","name":"Living room","image":[{"@type":"ImageObject","url":"https://cdn.example-portal.com/listing/123/ld.webp","caption":"Living room"}]}</script>
    <img src="/static/logo.png"><img src="/img/agent-photo.jpg"><img src="data:image/png;base64,AAAA">
    <img srcset="https://cdn.example-portal.com/listing/123/k-400.jpg 400w, https://cdn.example-portal.com/listing/123/k-1600.jpg 1600w">
    <img src="https://cdn.example-portal.com/icons/pin.svg">
    <script>window.__DATA__={"photos":["https:\/\/cdn.example-portal.com\/listing\/123\/g1.jpg?w=1200"]}</script>
    <img data-src="/listing/123/bath.png">`;
  assert.deepEqual(extractImageUrls(html, page), [
    'https://cdn.example-portal.com/listing/123/main.jpg',
    'https://cdn.example-portal.com/listing/123/ld.webp',
    'https://cdn.example-portal.com/listing/123/k-1600.jpg',
    'https://www.example-portal.com/listing/123/bath.png',
    'https://cdn.example-portal.com/listing/123/g1.jpg?w=1200',
  ]);
});

test('extraction is capped and de-duplicated', () => {
  const html = Array.from({ length: 50 }, (_, i) => `<img src="https://cdn.x.com/p/${i % 40}.jpg">`).join('');
  const urls = extractImageUrls(html, page, 30);
  assert.equal(urls.length, 30);
  assert.equal(new Set(urls).size, 30);
});

test('private, loopback and link-local addresses are refused', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])
    assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '104.16.0.1', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
});

test('URLs that are not public http(s) host names are refused before any lookup', async () => {
  for (const url of ['file:///etc/passwd', 'http://127.0.0.1/x.jpg', 'http://[::1]/x.jpg', 'http://localhost/x.jpg', 'http://printer.local/x.jpg', 'https://user:pw@example.com/x.jpg', 'not a url'])
    await assert.rejects(assertPublicUrl(url), url);
});

test('image type is read from the bytes, not the label', () => {
  assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d])), 'image/png');
  assert.equal(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImageType(new TextEncoder().encode('<html><body>')), '');
});

test('photo URLs are found in web_fetch page text and only the largest size of each is kept', () => {
  const text = `meta-og:image: https://images.bayut.com/thumbnails/875769764-400x300.jpeg
![](https://images.bayut.com/thumbnails/875769764-800x600.jpeg) ![](https://images.bayut.com/thumbnails/875769765-400x300.jpeg)
[photo](https://images.bayut.com/thumbnails/875769765-800x600.jpeg) https://images.bayut.com/thumbnails/875769766-400x300.jpeg`;
  assert.deepEqual(extractImageUrls(text, 'https://www.bayut.com/property/details-16985323.html'), [
    'https://images.bayut.com/thumbnails/875769764-800x600.jpeg',
    'https://images.bayut.com/thumbnails/875769765-800x600.jpeg',
    'https://images.bayut.com/thumbnails/875769766-400x300.jpeg',
  ]);
});

test('image proxies are unwrapped to the photo itself', () => {
  assert.equal(unwrapImageUrl('https://site.ae/_next/image/?url=https%3A%2F%2Fcdn.site.ae%2Fp%2F1.png&w=3840&q=75'), 'https://cdn.site.ae/p/1.png');
  assert.equal(unwrapImageUrl('https://site.ae/_next/image?url=%2Fuploads%2F2.jpg&w=640'), 'https://site.ae/uploads/2.jpg');
  assert.equal(unwrapImageUrl('https://site.ae/cdn-cgi/image/width=800/https://cdn.site.ae/3.jpg'), 'https://cdn.site.ae/3.jpg');
});

test('sizes and formats of one photo collapse to its largest copy (Property Finder style paths)', () => {
  const base = 'https://static.example.ae/media/images/listing/ABC/1111';
  const html = `<img src="${base}/260x185.jpg?v=a"><img src="${base}/668x452.webp?v=b"><img src="${base}/1312x894.jpg?v=c">`;
  assert.deepEqual(extractImageUrls(html, 'https://www.example.ae/en/plp/rent/x-1.html'), [`${base}/1312x894.jpg?v=c`]);
});

test('cards linking to other pages and "Similar" sections are marked as other images (offplan-dubai style text)', () => {
  const text = `# Shione
![Banner](https://www.op.com/wp-content/uploads/2026/11/Hero.jpg)
## Gallery
Gallery 1 ![Gallery 1](https://www.op.com/wp-content/uploads/2026/11/Gallery-1-1024x507.jpg)
Gallery 1 ![Gallery 1](https://www.op.com/wp-content/uploads/2026/11/Gallery-1-300x149.jpg)
## Similar Projects
[Central Park ![Central Park](https://www.op.com/wp-content/uploads/2025/03/central-park.jpg)](https://www.op.com/central-park/)
![Unlinked](https://www.op.com/wp-content/uploads/2025/03/after-cut.jpg)`;
  assert.deepEqual(extractPagePhotos(text, 'https://www.op.com/shione/'), [
    { url: 'https://www.op.com/wp-content/uploads/2026/11/Hero.jpg' },
    { url: 'https://www.op.com/wp-content/uploads/2026/11/Gallery-1-1024x507.jpg' },
    { url: 'https://www.op.com/wp-content/uploads/2025/03/central-park.jpg', other: true },
    { url: 'https://www.op.com/wp-content/uploads/2025/03/after-cut.jpg', other: true },
  ]);
});

test('gallery JSON photos stored with the main photos count; data images from elsewhere and site defaults do not (Springfield style)', () => {
  const s3 = 'https://uploads.s3.example.com/springfield';
  const html = `<meta property="og:image" content="https://sf.ae/og-default.jpg">
    <a href="/for-sale/other-unit/"><img src="/_next/image/?url=${encodeURIComponent(s3 + '/other.png')}&amp;w=640"></a>
    <img src="/_next/image/?url=${encodeURIComponent(s3 + '/g1.png')}&amp;w=3840">
    <script>self.__next_f.push(["{\\"images\\":[\\"${s3}/g1.png\\",\\"${s3}/g2.png\\",\\"${s3}/other.png\\"]}"])</script>
    <script>{"community":"https://graph.example.com/ae/community/1/a/thumb.jpeg"}</script>`;
  assert.deepEqual(extractPagePhotos(html, 'https://sf.ae/for-sale/this-unit/'), [
    { url: `${s3}/g1.png` },
    { url: `${s3}/g2.png` },
    { url: `${s3}/other.png`, other: true },
    { url: 'https://graph.example.com/ae/community/1/a/thumb.jpeg', other: true },
  ]);
});

test('a page our request can read gives its visible text when web_fetch returns nothing', () => {
  const html = `<html><head><title>Rent in Zinnia | Portal</title><style>.a{}</style></head><body>
    <script>window.x = "AED 999";</script><nav>Buy Rent</nav>
    <div><span>115,000</span> <span>yearly</span></div><h2>Property details</h2>
    <ul><li>Bedrooms<br>3 Beds</li><li>Furnishing&nbsp;Unfurnished</li></ul><p>Children&#39;s Play Area &amp; Pool</p></body></html>`;
  assert.equal(htmlToText(html), "Rent in Zinnia | Portal\nBuy Rent\n115,000 yearly\n## Property details\n- Bedrooms\n3 Beds\n- Furnishing Unfurnished\nChildren's Play Area & Pool");
});
