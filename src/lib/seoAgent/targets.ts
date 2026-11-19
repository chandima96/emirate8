import { createHash } from 'node:crypto';
import { isPublicListing } from '../propertySearch';
import { brokerFacts, brokerPath, propertyFacts, propertyPath, type SeoTarget } from './facts';

/* Server-side half of the fact sheets: hashing (node:crypto) and the list of pages to write for. */

/** Deterministic JSON (sorted keys) so the same facts always hash the same. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value as object)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stable((value as any)[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}

export const hashFacts = (facts: Record<string, unknown>) => createHash('sha256').update(stable(facts)).digest('hex').slice(0, 32);

/** Every public property and broker page the agent writes for, with current fact hashes. */
export function seoTargets(data: any, brokers: any[]): SeoTarget[] {
  const byId = new Map(brokers.map((b) => [String(b.id), b]));
  const properties = (data?.listings || [])
    .filter((l: any) => isPublicListing(l) && (l.slug || l.id))
    .map((l: any) => {
      const facts = propertyFacts(l, byId);
      return { kind: 'property' as const, path: propertyPath(l.slug || l.id), area: String(l.area || ''), facts, hash: hashFacts(facts) };
    });
  const profiles = brokers
    .filter((b) => b.slug && b.type !== 'agency')
    .map((b) => {
      const facts = brokerFacts(b);
      return { kind: 'broker' as const, path: brokerPath(b.slug), area: '', facts, hash: hashFacts(facts) };
    });
  return [...properties, ...profiles];
}
