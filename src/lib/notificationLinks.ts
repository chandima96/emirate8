export function notificationPropertyHref(notification: any) {
  const property = notification?.property;
  const slug = notification?.propertySlug || (typeof property === 'object' && property ? property.slug : '');
  return typeof slug === 'string' && slug ? `/property/${encodeURIComponent(slug)}` : null;
}
