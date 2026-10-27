/* Small framework-free helpers shared by the data layer and components. */

export function uid(prefix) {
  return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function daysFromNow(days) {
  return new Date(Date.now() + days * 864e5).toISOString();
}

export function slugify(value) {
  return (
    String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'listing'
  );
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Joins class names, skipping falsy values. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function initialsOf(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export const RX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  uaeMobile: /^(?:971|0)?5[024568]\d{7}$/,
};

export function normaliseMobile(value) {
  let d = digits(value);
  if (d.indexOf('971') === 0) d = d.slice(3);
  if (d.indexOf('0') === 0) d = d.slice(1);
  return d.length === 9 ? '+971 ' + d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5) : value;
}

export function passwordScore(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) && p.length >= 10) s++;
  return Math.min(s, 4);
}

export function fmtBytes(b) {
  return b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
}

/** Downscales an image for saving with a listing record in Supabase. */
export function fileToDataURL(file, max = 900, quality = 0.72) {
  return new Promise<string | null>((resolve, reject) => {
    if (!/^image\//.test(file.type)) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const r = Math.min(1, max / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.round(w * r);
        c.height = Math.round(h * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(null);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
