import { notFound } from 'next/navigation';
import { AreaLanding, landingHeading, landingPath, landingSummary } from '@/components/portal/AreaLanding';
import { loadLanding } from '@/lib/server/landing';
import { filterQuery } from '@/lib/propertySearch';
import { absoluteUrl, metaDescription } from '@/lib/siteUrl';

export type LandingProps = {
  params: Promise<{ area: string; segment?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load({ params, searchParams }: LandingProps) {
  const [{ area, segment }, sp] = await Promise.all([params, searchParams]);
  const page = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  return loadLanding(decodeURIComponent(area).toLowerCase(), segment && decodeURIComponent(segment).toLowerCase(), page);
}

/** Shared by /properties/[area] and /properties/[area]/[segment]. */
export async function landingMetadata(props: LandingProps) {
  const l = await load(props);
  if (!l) return { title: 'No listings found', robots: { index: false, follow: true } };
  const canonical = landingPath(l) + filterQuery({ page: l.page });
  const title = landingHeading(l) + (l.page > 1 ? ` – page ${l.page}` : '');
  const description = metaDescription(landingSummary(l) + ' Photos, prices and the listing broker for every property.');
  const image = l.listings.map((x) => x.featured || x.images?.[0]).find((src) => src && !/^data:/.test(src));
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: { type: 'website', siteName: 'Emirate08', title, description, url: absoluteUrl(canonical), ...(image ? { images: [absoluteUrl(image)] } : {}) },
  };
}

export async function LandingPage(props: LandingProps) {
  const l = await load(props);
  if (!l) notFound();
  return <AreaLanding {...l} />;
}
