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
  const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');
  const socials = (Array.isArray(profile.socials) ? profile.socials : []).filter((s) => safeUrl(s?.url));
  const projects = (Array.isArray(profile.projects) ? profile.projects : []).filter((p) => p?.name);
  const tags = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
  const stats = [
    [profile.established, 'Established'],
    [profile.completedProjects && Number(profile.completedProjects).toLocaleString('en-US'), 'Projects delivered'],
    [profile.unitsDelivered && Number(profile.unitsDelivered).toLocaleString('en-US'), 'Units delivered'],
  ].filter(([v]) => v);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Organization', name: profile.displayName || developer.name, url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/developers/${developer.slug}`, description: profile.description || undefined, foundingDate: profile.established || undefined, email: profile.email || undefined, telephone: profile.phone || undefined, sameAs: [safeUrl(profile.website), ...socials.map((s) => s.url)].filter(Boolean) };
  return <div className="wrap py-10"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><p className="eyebrow">Property developer</p><h1 className="h1 mt-3">{profile.displayName || developer.name}</h1>{profile.tagline && <p className="mt-2 text-lg text-ink">{profile.tagline}</p>}<p className="mt-3 max-w-2xl whitespace-pre-line text-muted">{profile.description || 'Published project inventory and developer-direct opportunities across the UAE.'}</p>
    {!!stats.length && <dl className="mt-6 flex flex-wrap gap-8">{stats.map(([v, label]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="font-display text-2xl font-semibold">{v}</dd></div>)}</dl>}
    <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted">{safeUrl(profile.website) && <a className="link" href={safeUrl(profile.website)} rel="noopener" target="_blank">Website</a>}{profile.location && <span>{profile.location}</span>}{profile.phone && <a className="link" href={'tel:' + String(profile.phone).replace(/[^\d+]/g, '')}>{profile.phone}</a>}{profile.email && <a className="link" href={'mailto:' + profile.email}>{profile.email}</a>}{socials.map((s) => <a key={s.url} className="link" href={s.url} rel="noopener" target="_blank">{s.platform}</a>)}{profile.registrationNumber && <span>Reg. no. {profile.registrationNumber}</span>}</div>
    {(!!tags(profile.projectTypes).length || !!tags(profile.areas).length) && <div className="mt-6 space-y-2">{([[tags(profile.projectTypes), 'Builds'], [tags(profile.areas), 'Communities']] as [string[], string][]).filter(([v]) => v.length).map(([v, label]) => <div key={label} className="flex flex-wrap items-center gap-1.5 text-sm"><span className="mr-1 text-muted">{label}:</span>{v.map((x) => <span key={x} className="chip">{x}</span>)}</div>)}</div>}
    {!!projects.length && <section className="mt-10"><h2 className="h2">Key projects</h2><ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{projects.map((p) => <li key={p.name} className="card p-4"><p className="font-semibold">{p.name}</p><p className="mt-1 text-sm text-muted">{[p.location, p.status].filter(Boolean).join(' · ')}</p></li>)}</ul></section>}
    <section className="mt-10"><h2 className="h2">Published properties</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{properties.map((property) => <Link className="card p-5 hover:border-sage" href={`/property/${property.slug}`} key={property.id}><h3 className="font-display text-lg font-semibold">{property.title}</h3><p className="mt-2 text-sm text-muted">{property.type} · {property.area} · {property.purpose === 'rent' ? 'For rent' : 'For sale'}</p><p className="mt-3 font-semibold">AED {Number(property.price || 0).toLocaleString()}</p></Link>)}{!properties.length && <p className="text-sm text-muted">No published properties yet.</p>}</div></section></div>;
}
