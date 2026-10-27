import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDeveloper } from '@/lib/cms';
import { listingFromProperty } from '@/lib/server/member-properties';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const developer = await getDeveloper(slug);
  if (!developer) return { title: 'Developer not found', robots: { index: false, follow: false } };
  return { title: `${developer.profile?.developer?.displayName || developer.name} | Emirate08`, description: developer.profile?.developer?.description || `Published UAE property listings from ${developer.name}.` };
}

export default async function DeveloperPage({ params }) {
  const { slug } = await params;
  const developer = await getDeveloper(slug);
  if (!developer) notFound();
  const profile = developer.profile?.developer || {};
  const properties = developer.properties.map(listingFromProperty);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Organization', name: profile.displayName || developer.name, url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/developers/${developer.slug}`, description: profile.description || undefined };
  return <div className="wrap py-10"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><p className="eyebrow">Property developer</p><h1 className="h1 mt-3">{profile.displayName || developer.name}</h1><p className="mt-3 max-w-2xl text-muted">{profile.description || 'Published project inventory and developer-direct opportunities across the UAE.'}</p><div className="mt-8 flex flex-wrap gap-3 text-sm text-muted">{profile.website && <a className="link" href={profile.website}>Website</a>}{profile.location && <span>{profile.location}</span>}{profile.phone && <span>{profile.phone}</span>}</div><section className="mt-10"><h2 className="h2">Published properties</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{properties.map((property) => <Link className="card p-5 hover:border-sage" href={`/property/${property.slug}`} key={property.id}><h3 className="font-display text-lg font-semibold">{property.title}</h3><p className="mt-2 text-sm text-muted">{property.type} · {property.area} · {property.purpose === 'rent' ? 'For rent' : 'For sale'}</p><p className="mt-3 font-semibold">AED {Number(property.price || 0).toLocaleString()}</p></Link>)}{!properties.length && <p className="text-sm text-muted">No published properties yet.</p>}</div></section></div>;
}
