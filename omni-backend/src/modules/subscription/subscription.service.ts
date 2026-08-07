import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException, ErrorCode } from '../../common/errors/error-codes';

const CANCELABLE_STATUSES = new Set(['PENDING', 'ACTIVE', 'PAST_DUE']);

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { priceAmount: 'asc' },
    });
  }

  listOwnedBy(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: {
        business: { select: { id: true, name: true } },
        plan: {
          select: {
            id: true,
            name: true,
            priceAmount: true,
            priceCurrency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAll() {
    return this.prisma.subscription.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        business: { select: { id: true, name: true } },
        plan: {
          select: {
            id: true,
            name: true,
            priceAmount: true,
            priceCurrency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancel(id: string, userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });
    if (!subscription) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
        "Cet abonnement n'existe pas.",
      );
    }
    if (subscription.userId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_FORBIDDEN,
        'Cet abonnement ne vous appartient pas.',
      );
    }
    if (!CANCELABLE_STATUSES.has(subscription.status)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.SUBSCRIPTION_NOT_CANCELABLE,
        'Cet abonnement ne peut plus être annulé.',
      );
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
  }
}
