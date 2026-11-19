import { loadPublicDataSafe } from '@/lib/server/publicData';
import { publicBrokers } from '@/lib/server/landing';
import { brokerAreas, listingAreas } from '@/lib/propertySearch';
import { SITE_URL } from '@/lib/siteUrl';

/*
 * /llms.txt (llmstxt.org): a short Markdown guide to the site for AI assistants and agents. Few crawlers
 * read it yet; it is cheap to serve and points them at the pages worth citing.
 */
export const revalidate = 3600;

export async function GET() {
  const data = await loadPublicDataSafe();
  const areas = listingAreas(data?.listings || []).slice(0, 40);
  const agentAreas = brokerAreas(publicBrokers(data)).slice(0, 40);
  const lines = [
    '# Emirate08',
    '',
    '> Dubai and UAE real estate portal: properties for sale and rent listed by licensed brokers, agencies and developers, with broker profiles that show RERA registration (BRN), languages, areas covered and current listings.',
    '',
    'Each property page has the asking price in AED, size, bedrooms, completion status, location, photos and the listing broker, plus schema.org RealEstateListing data. Broker pages are schema.org ProfilePage/Person records.',
    '',
    '## Search',
    '',
    `- [All properties](${SITE_URL}/properties): every public listing, newest first`,
    `- [Properties for sale](${SITE_URL}/properties?purpose=sale)`,
    `- [Properties for rent](${SITE_URL}/properties?purpose=rent)`,
    `- [Real estate agents and agencies](${SITE_URL}/agents)`,
    `- [Developers](${SITE_URL}/developers)`,
    '',
  ];
  if (areas.length) {
    lines.push('## Properties by area', '');
    areas.forEach((a) => lines.push(`- [Properties in ${a.name}](${SITE_URL}/properties/${a.slug}): ${a.count} listing${a.count === 1 ? '' : 's'}`));
    lines.push('');
  }
  if (agentAreas.length) {
    lines.push('## Agents by area', '');
    agentAreas.forEach((a) => lines.push(`- [Real estate agents in ${a.name}](${SITE_URL}/agents/${a.slug})`));
    lines.push('');
  }
  lines.push('## Optional', '', `- [Sitemap](${SITE_URL}/sitemap.xml): every public property, broker, agency and area page`, '');
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
