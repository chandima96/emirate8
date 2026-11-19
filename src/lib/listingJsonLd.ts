/* schema.org structured data for a public property page (RealEstateListing + Offer + Accommodation),
 * matching what Property Finder and Bayut publish. Built only from the already-sanitised public listing. */
import { SITE_URL as SITE } from './siteUrl';
import { areaSlug } from './propertySearch';

const ACCOMMODATION: Record<string, string> = {
  Apartment: 'Apartment',
  Penthouse: 'Apartment',
  Duplex: 'Apartment',
  'Hotel apartment': 'Apartment',
  Villa: 'SingleFamilyResidence',
  Townhouse: 'House',
  'Commercial villa': 'House',
};

const absolute = (src: string) => (!src ? '' : /^https?:\/\//.test(src) ? src : SITE + (src.startsWith('/') ? '' : '/') + src);

export function listingJsonLd(l: any) {
  const url = SITE + '/property/' + encodeURIComponent(l.slug || l.id);
  const locality = [l.building, l.subcommunity].filter(Boolean).join(', ');
  const address = {
    '@type': 'PostalAddress',
    addressCountry: 'AE',
    addressRegion: l.emirate || 'Dubai',
    addressLocality: l.area || undefined,
    ...(locality ? { streetAddress: locality } : {}),
  };
  const images = [l.featured, ...(l.images || [])].filter(Boolean).map(absolute);
  const amenityFeature = (l.amenities || []).map((name: string) => ({
    '@type': 'LocationFeatureSpecification',
    name,
    value: true,
  }));
  (Array.isArray(l.views) ? l.views : []).forEach((v: string) =>
    amenityFeature.push({ '@type': 'LocationFeatureSpecification', name: 'View: ' + v, value: true }),
  );
  const offer = l.price
    ? {
        '@type': 'Offer',
        price: l.price,
        priceCurrency: 'AED',
        availability: 'https://schema.org/InStock',
        businessFunction: l.purpose === 'rent' ? 'https://purl.org/goodrelations/v1#LeaseOut' : 'https://purl.org/goodrelations/v1#Sell',
        ...(l.purpose === 'rent'
          ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: l.price, priceCurrency: 'AED', unitCode: 'ANN' } }
          : {}),
      }
    : undefined;
  const accommodation = {
    '@type': ACCOMMODATION[l.type] || 'Accommodation',
    name: l.title,
    ...(l.size ? { floorSize: { '@type': 'QuantitativeValue', value: l.size, unitCode: 'FTK' } } : {}),
    ...(l.beds !== '' && l.beds != null ? { numberOfBedrooms: Number(l.beds) } : {}),
    ...(l.baths ? { numberOfBathroomsTotal: Number(l.baths) } : {}),
    ...(l.completionYear ? { yearBuilt: Number(l.completionYear) } : {}),
    ...(amenityFeature.length ? { amenityFeature } : {}),
    address,
    ...(l.coordinates?.lat && l.coordinates?.lng
      ? { geo: { '@type': 'GeoCoordinates', latitude: l.coordinates.lat, longitude: l.coordinates.lng } }
      : {}),
  };
  const crumbs = [
    ['Emirate08', SITE + '/'],
    [l.purpose === 'rent' ? 'Properties for rent' : 'Properties for sale', SITE + '/properties?purpose=' + (l.purpose === 'rent' ? 'rent' : 'sale')],
    [l.area, l.area ? SITE + '/properties/' + areaSlug(l.area) + '/for-' + (l.purpose === 'rent' ? 'rent' : 'sale') : ''],
    [l.title, url],
  ].filter(([name]) => name);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      '@id': url,
      url,
      name: l.title,
      description: String(l.description || '').slice(0, 5000) || undefined,
      ...(l.createdAt ? { datePosted: l.createdAt } : {}),
      ...(l.updatedAt ? { dateModified: l.updatedAt } : {}),
      ...(images.length ? { image: images.slice(0, 10) } : {}),
      ...(offer ? { offers: offer } : {}),
      about: accommodation,
      ...(l.broker?.name
        ? {
            provider: {
              '@type': 'RealEstateAgent',
              name: l.broker.agencyName || l.broker.name,
              ...(l.broker.slug && l.broker.isPublic !== false
                ? { url: SITE + '/brokers/' + encodeURIComponent(l.broker.slug) }
                : {}),
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map(([name, item], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name,
        ...(item ? { item } : {}),
      })),
    },
  ];
}
