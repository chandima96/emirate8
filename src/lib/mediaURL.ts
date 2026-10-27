/** Bypass browser redirects cached by the former /images storage redirect. */
export function mediaDisplayURL(src: string): string {
  return src?.startsWith('/images/') ? `/api/media-assets/${src.slice('/images/'.length)}` : src;
}
