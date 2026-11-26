import type { CollectionAfterChangeHook } from 'payload';
import { brokerIdsOf } from '@/lib/propertyBrokers';

type NotificationType = 'developer_property_published' | 'developer_property_updated' | 'broker_assigned';

/**
 * Fan out a published developer listing to active broker subscriptions.
 * The event key is recipient-specific so a retry is idempotent while every
 * subscriber still receives its own notification.
 */
export const notifyDeveloperSubscribers: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const developerId = doc.ownerDeveloper || doc.appData?.ownerMemberId;
  if (!developerId || doc.status !== 'published' || doc.display?.visible === false) return doc;

  try {
  const firstPublication = previousDoc?.status !== 'published';
  const subscriptions = await req.payload.find({
    collection: 'developer-subscriptions',
    where: {
      and: [
        { developer: { equals: typeof developerId === 'object' ? developerId.id : developerId } },
        { status: { equals: 'active' } },
        firstPublication ? { notifyNewListings: { equals: true } } : { notifyUpdates: { equals: true } },
      ],
    },
    limit: 1000,
    overrideAccess: true,
  });

  const eventType = firstPublication ? 'developer_property_published' : 'developer_property_updated';
  const stamp = doc.updatedAt || new Date().toISOString();
  const recipients: Array<{ recipient: number | string; type: NotificationType }> = (subscriptions.docs as any[]).map((subscription) => ({ recipient: typeof subscription.broker === 'object' ? subscription.broker.id : subscription.broker, type: eventType as NotificationType }));
  // Every broker added to the property since the previous save is told once.
  const before = new Set(brokerIdsOf(previousDoc));
  const added = brokerIdsOf(doc).filter((id) => !before.has(id));
  if (added.length) {
    const brokers = await req.payload.find({ collection: 'brokers', where: { id: { in: added } }, limit: added.length, depth: 0, overrideAccess: true });
    for (const broker of brokers.docs as any[]) {
      const memberId = broker?.appData?.ownerMemberId;
      if (memberId && !recipients.some((item) => String(item.recipient) === String(memberId))) recipients.push({ recipient: memberId, type: 'broker_assigned' });
    }
  }
  for (const entry of recipients) {
    const recipient = entry.recipient;
    if (!recipient) continue;
    const eventKey = `${entry.type}:${doc.id}:${stamp}:${recipient}`;
    const existing = await req.payload.find({
      collection: 'notifications',
      where: { eventKey: { equals: eventKey } },
      limit: 1,
      overrideAccess: true,
    });
    if (existing.docs[0]) continue;
    await req.payload.create({
      collection: 'notifications',
      data: {
        recipient: recipient as any,
        type: entry.type,
        title: entry.type === 'broker_assigned' ? 'Added as a broker' : firstPublication ? 'New developer property' : 'Developer property updated',
        message: entry.type === 'broker_assigned' ? `You are now one of the brokers for ${doc.title}.` : firstPublication ? `${doc.title} is now available.` : `${doc.title} has been updated.`,
        property: doc.id,
        developer: typeof developerId === 'object' ? developerId.id : developerId,
        read: false,
        delivery: 'in_app',
        eventKey,
      },
      overrideAccess: true,
    });
  }
  return doc;
  } catch (error) {
    // Notification fan-out must not roll back a property save when the
    // subscriptions or notifications tables are temporarily unavailable.
    console.error('[property-notifications] Could not notify developer subscribers:', error);
    return doc;
  }
};
