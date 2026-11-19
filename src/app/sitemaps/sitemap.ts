import type { MetadataRoute } from 'next';
import { getAgencies, getBrokerSitemap, getDevelopers, getPropertySitemapCount, getPropertySitemapPage } from '@/lib/cms';
import { loadPublicDataSafe } from '@/lib/server/publicData';
import { publicBrokers } from '@/lib/server/landing';
import { areaSegments, brokerAreas, listingAreas, listingsInArea, segmentFor } from '@/lib/propertySearch';
import { SITE_URL } from '@/lib/siteUrl';

/*
 * Split sitemaps (served at /sitemaps/sitemap/<id>.xml and listed by the index at /sitemap.xml):
 *   0      site pages, area landing pages, broker, agency and developer profiles
 *   1..n   property pages, SITEMAP_CHUNK per file
 */
export async function generateSitemaps() {
  const propertyFiles = await getPropertySitemapCount();
  return [{ id: 0 }, ...Array.from({ length: propertyFiles }, (_, i) => ({ id: i + 1 }))];
}

const date = (value: unknown) => {
  const d = value ? new Date(String(value)) : null;
  return d && Number.isFinite(d.getTime()) ? d : undefined;
};

/** The newest `updatedAt` in a set of records. */
const newest = (records: any[]) =>
  records.reduce<Date | undefined>((acc, r) => {
    const d = date(r.updatedAt || r.createdAt);
    return d && (!acc || d > acc) ? d : acc;
  }, undefined);

async function sitePages(): Promise<MetadataRoute.Sitemap> {
  const [brokers, agencies, developers, data] = await Promise.all([
    getBrokerSitemap(),
    getAgencies(),
    getDevelopers(),
    loadPublicDataSafe(),
  ]);
  const listings: any[] = data?.listings || [];
  const latest = newest(listings);
  const landing: MetadataRoute.Sitemap = listingAreas(listings).flatMap((area) => {
    const inArea = listingsInArea(listings, area.slug);
    return [
      { url: `${SITE_URL}/properties/${area.slug}`, lastModified: newest(inArea) },
      ...areaSegments(inArea).map((s) => ({
        url: `${SITE_URL}/properties/${area.slug}/${segmentFor(s.type, s.purpose)}`,
        lastModified: newest(
          inArea.filter((l) => (l.purpose === 'rent' ? 'rent' : 'sale') === s.purpose && (!s.type || l.type === s.type)),
        ),
      })),
    ];
  });
  return [
    { url: `${SITE_URL}/`, lastModified: latest },
    { url: `${SITE_URL}/properties`, lastModified: latest },
    { url: `${SITE_URL}/properties?purpose=sale`, lastModified: latest },
    { url: `${SITE_URL}/properties?purpose=rent`, lastModified: latest },
    { url: `${SITE_URL}/agents` },
    { url: `${SITE_URL}/developers` },
    ...landing,
    ...brokerAreas(publicBrokers(data)).map((a) => ({ url: `${SITE_URL}/agents/${a.slug}` })),
    ...brokers.map((b) => ({ url: `${SITE_URL}/brokers/${encodeURIComponent(b.slug)}`, lastModified: date(b.updatedAt) })),
    ...(agencies as any[])
      .filter((a) => a.slug)
      .map((a) => ({ url: `${SITE_URL}/agencies/${encodeURIComponent(a.slug)}`, lastModified: date(a.updatedAt) })),
    ...developers.map((d) => ({ url: `${SITE_URL}/developers/${encodeURIComponent(d.slug)}` })),
  ];
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  if (!id) return sitePages();
  const properties = await getPropertySitemapPage(id);
  return properties.map((p) => ({
    url: `${SITE_URL}/property/${encodeURIComponent(p.slug)}`,
    lastModified: date(p.updatedAt),
  }));
}
