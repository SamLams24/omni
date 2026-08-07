import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException, ErrorCode } from '../../common/errors/error-codes';
import { FedaPayClientService } from './fedapay-client.service';
import { isValidFedaPayTransactionId } from './fedapay.util';
import type { CreateSubscriptionPaymentDto } from './dto/create-subscription-payment.dto';

// SubscriptionPlan has no explicit billing-period field yet -- every plan
// is currently monthly (see prisma/seed.ts "Premium mensuel"), so a fixed
// 30-day period is applied on activation. Documented simplification, not
// an oversight: a real per-plan period would be a schema addition.
const SUBSCRIPTION_PERIOD_DAYS = 30;

type WebhookEvent = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  object_id?: unknown;
  entity?: { id?: unknown };
};

/** Stringifies only string/number/bigint -- avoids "[object Object]" leaking through as a fake id. */
function stringifyId(value: unknown): string {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
    ? String(value)
    : '';
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fedaPayClient: FedaPayClientService,
    private readonly config: ConfigService,
  ) {}

  listAll() {
    return this.prisma.payment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async initiateSubscriptionPayment(
    userId: string,
    dto: CreateSubscriptionPaymentDto,
  ) {
    const owner = await this.prisma.businessOwner.findUnique({
      where: { businessId_userId: { businessId: dto.businessId, userId } },
    });
    if (!owner) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_FORBIDDEN,
        "Vous n'êtes pas propriétaire de cette entreprise.",
      );
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.PAYMENT_PLAN_UNKNOWN,
        "Ce plan d'abonnement n'existe pas.",
      );
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        businessId: dto.businessId,
        planId: plan.id,
        tier: plan.tier,
        status: 'PENDING',
      },
    });

    // The amount is always the server's own record of the plan's price --
    // never anything the client sent (the DTO only carries planId).
    const amount = Number(plan.priceAmount);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        planId: plan.id,
        amount,
        currency: plan.priceCurrency,
        method: 'USSD_PUSH',
        status: 'PENDING',
      },
    });

    try {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';
      const transaction = await this.fedaPayClient.createTransaction({
        amount,
        currency: { iso: plan.priceCurrency },
        description: `Abonnement ${plan.name} - OMNI`,
        callback_url: `${frontendUrl}/seller/subscription?payment=fedapay`,
        custom_metadata: { omni_payment_id: payment.id },
      });
      const providerTransactionId = stringifyId(
        (transaction as { id?: unknown }).id,
      );
      if (!isValidFedaPayTransactionId(providerTransactionId)) {
        throw new AppException(
          HttpStatus.SERVICE_UNAVAILABLE,
          ErrorCode.PAYMENT_FAILED,
          'FedaPay a renvoyé un identifiant de transaction invalide.',
        );
      }

      await this.prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          providerTransactionId,
          status: 'PENDING',
        },
      });

      const checkout = await this.fedaPayClient.generateCheckout(transaction);

      try {
        await this.fedaPayClient.sendMobileMoneyPush(transaction, {
          token: checkout.token,
          phoneNumber: dto.phoneNumber,
        });
        return {
          paymentId: payment.id,
          flow: 'mobile_money_push' as const,
          checkoutUrl: checkout.url,
        };
      } catch {
        // The push attempt failed (or its outcome is uncertain after a
        // provider timeout) -- the hosted checkout uses the same
        // transaction, so the user can still complete payment there.
        return {
          paymentId: payment.id,
          flow: 'hosted_checkout' as const,
          checkoutUrl: checkout.url,
        };
      }
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        }),
        this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED' },
        }),
      ]);
      throw error;
    }
  }

  async handleFedaPayWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
  ) {
    const event = this.fedaPayClient.constructWebhookEvent(
      rawBody,
      signatureHeader,
    ) as WebhookEvent;

    const eventName = typeof event.name === 'string' ? event.name : event.type;
    if (eventName !== 'transaction.approved') {
      return { received: true, ignored: true };
    }

    const rawTransactionId = event.object_id ?? event.entity?.id;
    const transactionId = stringifyId(rawTransactionId);
    if (!isValidFedaPayTransactionId(transactionId)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Événement de transaction invalide.',
      );
    }

    const paymentTransaction = await this.prisma.paymentTransaction.findUnique({
      where: { providerTransactionId: transactionId },
      include: { payment: true },
    });
    if (!paymentTransaction) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PAYMENT_FAILED,
        'Aucun paiement OMNI ne correspond à cette transaction.',
      );
    }
    if (paymentTransaction.payment.status === 'SUCCEEDED') {
      return { received: true, duplicate: true };
    }

    const transaction =
      await this.fedaPayClient.retrieveTransaction(transactionId);
    const identity = stringifyId((transaction as { id?: unknown }).id);
    if (identity !== transactionId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PAYMENT_FAILED,
        'Incohérence sur l’identité de la transaction.',
      );
    }
    if ((transaction as { status?: unknown }).status !== 'approved') {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.PAYMENT_PENDING,
        "La transaction n'est pas encore approuvée.",
      );
    }
    const confirmedAmount = Number(
      (transaction as { amount?: unknown }).amount,
    );
    if (
      !Number.isFinite(confirmedAmount) ||
      confirmedAmount !== Number(paymentTransaction.payment.amount)
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PAYMENT_FAILED,
        'Le montant de la transaction ne correspond pas.',
      );
    }
    const metadata = (
      transaction as { custom_metadata?: { omni_payment_id?: unknown } }
    ).custom_metadata;
    if (metadata?.omni_payment_id !== paymentTransaction.paymentId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PAYMENT_FAILED,
        'Incohérence de propriétaire sur la transaction.',
      );
    }

    const subscriptionId = paymentTransaction.payment.subscriptionId;
    if (!subscriptionId) {
      // Cannot happen through initiateSubscriptionPayment (which always
      // creates the Subscription before the Payment that references it),
      // but a Payment is nullable-by-schema, so guard rather than assume.
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PAYMENT_FAILED,
        'Ce paiement n’est rattaché à aucun abonnement.',
      );
    }

    const activatedUntil = new Date();
    activatedUntil.setDate(activatedUntil.getDate() + SUBSCRIPTION_PERIOD_DAYS);

    await this.prisma.$transaction([
      this.prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: {
          status: 'SUCCEEDED',
          providerEventId: stringifyId(event.id),
          rawPayload: event as never,
        },
      }),
      this.prisma.payment.update({
        where: { id: paymentTransaction.paymentId },
        data: { status: 'SUCCEEDED' },
      }),
      this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'ACTIVE', endDate: activatedUntil },
      }),
    ]);

    this.logger.log(
      `Subscription activated for payment ${paymentTransaction.paymentId}`,
    );
    return { received: true, processed: true };
  }
}
