export function fmtNumber(n) {
  return Number(n || 0).toLocaleString('en-AE');
}
export function fmtAED(n) {
  return 'AED ' + fmtNumber(Math.round(n));
}
export function fmtCompact(n) {
  n = +n || 0;
  return n >= 1e6
    ? 'AED ' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
    : n >= 1e3
      ? 'AED ' + Math.round(n / 1e3) + 'K'
      : fmtAED(n);
}
function above(max, min) {
  return Number(max) > Number(min) ? Number(max) : 0;
}
export function fmtPrice(item) {
  if (!item || !item.price) return 'Price on request';
  const max = above(item.priceMax, item.price);
  return 'AED ' + fmtNumber(item.price) + (max ? ' – ' + fmtNumber(max) : '') + (item.purpose === 'rent' ? ' /year' : '');
}
/** "1,200 sqft" or "1,200 – 2,400 sqft" when the listing covers a range of sizes. */
export function fmtSize(item, key = 'size') {
  if (!item || !item[key]) return '';
  const max = above(item[key + 'Max'], item[key]);
  return fmtNumber(item[key]) + (max ? ' – ' + fmtNumber(max) : '') + ' sqft';
}
export function fmtSpecs(item) {
  var p = [];
  if (item.type) p.push(item.type);
  const bedsMax = above(item.bedsMax, item.beds);
  if (item.beds === 0 && bedsMax) p.push('Studio – ' + bedsMax + ' bed');
  else if (item.beds === 0 && /Apartment/.test(item.type || '')) p.push('Studio');
  else if (item.beds) p.push(item.beds + (bedsMax ? '–' + bedsMax : '') + ' bed');
  const bathsMax = above(item.bathsMax, item.baths);
  if (item.baths) p.push(item.baths + (bathsMax ? '–' + bathsMax : '') + ' bath');
  if (item.size) p.push(fmtSize(item));
  return p;
}
export function relTime(iso) {
  var s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  var d = Math.floor(s / 86400);
  return d === 1 ? 'Yesterday' : d + ' days ago';
}
export function fmtDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
