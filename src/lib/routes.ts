/* Route helpers — clean public URLs (/brokers/[slug], /property/[slug]). */
export const routes = {
  home: '/',
  properties: (query) => '/properties' + (query ? '?' + new URLSearchParams(query).toString() : ''),
  property: (l) => '/property/' + encodeURIComponent(l.slug || l.id),
  broker: (b) => '/brokers/' + encodeURIComponent(b.slug || b.id),
  agency: (a) => '/agencies/' + encodeURIComponent(a.id),
  listing: (id) => '/listings/' + encodeURIComponent(id),
  editListing: (id, step = undefined) =>
    '/listings/' + encodeURIComponent(id) + '/edit' + (step ? '?step=' + step : ''),
};
