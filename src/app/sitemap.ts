import { getAgencies, getBrokers, getDevelopers, getProperties } from '@/lib/cms';

export default async function sitemap() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const [properties, brokers, agencies, developers] = await Promise.all([getProperties({ limit: 500 }), getBrokers(), getAgencies(), getDevelopers()]);
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/properties`, lastModified: new Date() },
    { url: `${base}/developers`, lastModified: new Date() },
    ...properties.map((property: any) => ({ url: `${base}/property/${encodeURIComponent(property.slug)}`, lastModified: property.updatedAt || new Date() })),
    ...brokers.filter((broker: any) => broker.slug && broker.appData?.isPublic !== false && broker.appData?.searchable !== false).map((broker: any) => ({ url: `${base}/brokers/${encodeURIComponent(broker.slug)}`, lastModified: broker.updatedAt || new Date() })),
    ...agencies.filter((agency: any) => agency.slug).map((agency: any) => ({ url: `${base}/agencies/${encodeURIComponent(agency.slug)}`, lastModified: agency.updatedAt || new Date() })),
    ...developers.map((developer: any) => ({ url: `${base}/developers/${encodeURIComponent(developer.slug)}`, lastModified: new Date() })),
  ];
}
