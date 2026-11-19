import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';
import { SITE_URL } from '@/lib/siteUrl';

/*
 * IndexNow tells Bing (which ChatGPT search relies on), Yandex, Seznam and Naver that a URL changed, so
 * new, edited and removed listings are recrawled within minutes instead of days.
 *
 * Off unless INDEXNOW_KEY is set (any 8–128 character string of letters, digits and dashes). The key is
 * served at /indexnow.txt so the engines can confirm the site owns it. Pings only go out in production,
 * so seeding and local work never notify search engines.
 */
export const indexNowKey = () => {
  const key = process.env.INDEXNOW_KEY?.trim() || '';
  return /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : '';
};

export async function pingIndexNow(paths: string[]) {
  const key = indexNowKey();
  const urlList = [...new Set(paths.filter(Boolean))].map((p) => SITE_URL + p);
  if (!key || !urlList.length || process.env.NODE_ENV !== 'production') return;
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(SITE_URL).host, key, keyLocation: `${SITE_URL}/indexnow.txt`, urlList }),
      signal: AbortSignal.timeout(5000),
    });
    // 200 and 202 both mean accepted.
    if (!response.ok) console.warn('[indexnow] ping rejected:', response.status);
  } catch (error) {
    console.warn('[indexnow] ping failed:', error instanceof Error ? error.message : error);
  }
}

const slugOf = (doc: any) => (doc?.slug || doc?.appData?.slug ? String(doc.slug || doc.appData.slug) : '');

/** Ping without delaying the save; the ping's own errors are logged, never thrown. */
const queue = (paths: string[]) => void pingIndexNow(paths);

/** Properties: the listing URL, plus the old URL when the slug changed. */
export const indexNowProperty: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  const wasPublic = previousDoc?.status === 'published';
  const isPublic = doc?.status === 'published';
  if (wasPublic || isPublic) {
    queue(
      [slugOf(doc), slugOf(previousDoc)]
        .filter(Boolean)
        .map((slug) => '/property/' + encodeURIComponent(slug)),
    );
  }
  return doc;
};

export const indexNowPropertyDelete: CollectionAfterDeleteHook = ({ doc }) => {
  if (doc?.status === 'published' && slugOf(doc)) queue(['/property/' + encodeURIComponent(slugOf(doc))]);
  return doc;
};

/** Broker profiles. */
export const indexNowBroker: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  queue(
    [slugOf(doc), slugOf(previousDoc)]
      .filter(Boolean)
      .map((slug) => '/brokers/' + encodeURIComponent(slug)),
  );
  return doc;
};
