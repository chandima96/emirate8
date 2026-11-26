/*
 * A property has up to MAX_PROPERTY_BROKERS brokers (Payload `properties.brokers`, stored in properties_rels).
 * There is no "primary" broker: the list order is display order only.
 * Shared by the collection, the server sync, the listing editor and the public data (no server imports).
 */
export const MAX_PROPERTY_BROKERS = 5;

function idOf(value: unknown): string {
  const id = value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value;
  return id === null || id === undefined || id === '' ? '' : String(id);
}

/**
 * The property's broker IDs as strings, de-duplicated and capped at the maximum. Reads `brokers`, and still
 * understands the retired single-broker fields (`primaryBroker`, `broker`) in older saved workspace data.
 */
export function brokerIdsOf(listing: any): string[] {
  if (!listing || typeof listing !== 'object') return [];
  const source = Array.isArray(listing.brokers)
    ? listing.brokers
    : // Legacy scalar IDs only: a `broker` *object* is a display profile whose id may be a member ID.
      [listing.primaryBroker, typeof listing.broker === 'object' ? null : listing.broker];
  const ids: string[] = (source as unknown[]).map(idOf).filter((id) => id && /^\d+$/.test(id));
  return [...new Set(ids)].slice(0, MAX_PROPERTY_BROKERS);
}
