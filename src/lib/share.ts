/* Clipboard and share helpers (client only). */
export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise<void>((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      if (document.execCommand('copy')) resolve();
      else reject(new Error('copy failed'));
    } catch (err) {
      reject(err);
    }
    ta.remove();
  });
}

export function absUrl(path) {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return new URL(path, base).href;
}

/** Native share sheet where available, otherwise copies the link. `toast` comes from useFeedback(). */
export function share(title, path, toast) {
  const url = absUrl(path);
  if (navigator.share && /^https?:/.test(window.location.protocol) && window.matchMedia('(pointer: coarse)').matches) {
    return navigator.share({ title, url }).catch(() => {});
  }
  return copyText(url).then(
    () => toast?.('Link copied to clipboard.', { icon: 'link-45deg' }),
    () => window.prompt('Copy this link:', url),
  );
}
