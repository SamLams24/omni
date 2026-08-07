import type { Business, Subscription } from '@prisma/client';
import { computeBusinessStatus } from './business-status.util';
import type { BusinessDto } from './dto/business.dto';

export type BusinessWithSubscriptions = Business & {
  subscriptions: Pick<Subscription, 'tier' | 'status' | 'endDate'>[];
};

function hasActivePremiumSubscription(
  subscriptions: Pick<Subscription, 'tier' | 'status' | 'endDate'>[],
): boolean {
  const now = new Date();
  return subscriptions.some(
    (subscription) =>
      subscription.tier === 'PREMIUM' &&
      subscription.status === 'ACTIVE' &&
      (subscription.endDate === null || subscription.endDate > now),
  );
}

export function toBusinessDto(
  business: BusinessWithSubscriptions,
): BusinessDto {
  return {
    id: business.id,
    name: business.name,
    categoryId: business.categoryId,
    description: business.description,
    phone: business.phone,
    email: business.email,
    address: business.address,
    neighborhood: business.neighborhood,
    latitude: business.latitude ? Number(business.latitude) : null,
    longitude: business.longitude ? Number(business.longitude) : null,
    isOnline: business.isOnline,
    isAvailable: business.isAvailable,
    rating: business.rating ? Number(business.rating) : null,
    status: computeBusinessStatus({
      source: business.source,
      kycStatus: business.kycStatus,
      hasActivePremiumSubscription: hasActivePremiumSubscription(
        business.subscriptions,
      ),
    }),
    source: business.source,
    createdAt: business.createdAt.toISOString(),
  };
}
