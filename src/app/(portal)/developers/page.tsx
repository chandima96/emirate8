import Link from 'next/link';
import { getDevelopers } from '@/lib/cms';

export const metadata = { title: 'Property Developers in the UAE', description: 'Browse public UAE property developers and their published project inventory on Emirate08.' };

export default async function DevelopersPage() {
  const developers = await getDevelopers();
  return <div className="wrap py-10"><p className="eyebrow">Developers</p><h1 className="h1 mt-3">UAE property developers</h1><p className="mt-3 max-w-2xl text-muted">Explore public developer profiles and published properties across the UAE.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{developers.map((developer) => <Link className="card p-5 hover:border-sage" href={`/developers/${developer.slug}`} key={developer.id}><h2 className="font-display text-xl font-semibold">{developer.profile?.developer?.displayName || developer.name}</h2><p className="mt-2 text-sm text-muted">{developer.profile?.developer?.description || 'Published project inventory and developer-direct opportunities.'}</p></Link>)}{!developers.length && <p className="text-sm text-muted">No public developer profiles are available yet.</p>}</div></div>;
}
