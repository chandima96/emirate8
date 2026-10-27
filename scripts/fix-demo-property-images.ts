import 'dotenv/config';
import { getPayload } from 'payload';
import configPromise from '../payload.config';

const DEMO_IMAGES: Record<string, string[]> = {
  'demo-developer-creek-residences': ['/images/downtown-aerial.webp', '/images/palm-jumeirah.webp'],
  'demo-developer-jvc-townhouse': ['/images/dubai-hills.webp', '/images/downtown-dubai.webp'],
  'demo-broker-marina-apartment': ['/images/dubai-marina.webp', '/images/palm-jumeirah.webp'],
  'demo-broker-downtown-rental': ['/images/downtown-dubai.webp', '/images/downtown-aerial.webp'],
  'demo-agency-business-bay-office': ['/images/business-bay.webp', '/images/downtown-aerial.webp'],
  'demo-agency-hills-villa': ['/images/dubai-hills.webp', '/images/palm-jumeirah.webp'],
};

async function main() {
  const config: any = await configPromise;
  config.db.push = false;
  const payload = await getPayload({ config });
  let updated = 0;

  for (const [demoId, images] of Object.entries(DEMO_IMAGES)) {
    const result = await payload.find({
      collection: 'properties',
      where: { 'appData.id': { equals: demoId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const property: any = result.docs[0];
    if (!property) continue;

    const appData = property.appData && typeof property.appData === 'object' ? property.appData : {};
    const alreadyHasImages = Boolean(appData.featured || appData.images?.length || property.featuredImage || property.photos?.length);
    if (alreadyHasImages) continue;

    await payload.update({
      collection: 'properties',
      id: property.id,
      data: {
        appData: {
          ...appData,
          featured: images[0],
          images,
          photos: images.map((src, index) => ({ src, caption: index === 0 ? 'Featured property photo' : 'Property gallery photo' })),
        },
      },
      overrideAccess: true,
    });
    updated++;
  }

  console.log(`Added sample photos to ${updated} demo properties.`);
  await payload.destroy();
}

main().catch((error) => {
  console.error('Could not update demo property images:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
