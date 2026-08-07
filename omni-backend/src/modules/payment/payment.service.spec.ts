import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FedaPayClientService } from './fedapay-client.service';
import { AppException } from '../../common/errors/error-codes';

function buildTestModule() {
  const prisma = {
    businessOwner: { findUnique: jest.fn() },
    subscriptionPlan: { findUnique: jest.fn() },
    subscription: { create: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), update: jest.fn() },
    paymentTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const fedaPayClient = {
    createTransaction: jest.fn(),
    retrieveTransaction: jest.fn(),
    generateCheckout: jest.fn(),
    sendMobileMoneyPush: jest.fn(),
    constructWebhookEvent: jest.fn(),
  };
  const config = { get: jest.fn().mockReturnValue('https://omni.test') };

  return {
    prisma,
    fedaPayClient,
    config,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [
          PaymentService,
          { provide: PrismaService, useValue: prisma },
          { provide: FedaPayClientService, useValue: fedaPayClient },
          { provide: ConfigService, useValue: config },
        ],
      }).compile();
      return moduleRef.get(PaymentService);
    },
  };
}

const PLAN = {
  id: 'plan1',
  tier: 'PREMIUM',
  name: 'Premium mensuel',
  priceAmount: { toString: () => '5000' } as unknown as number,
  priceCurrency: 'XOF',
};

describe('PaymentService.initiateSubscriptionPayment', () => {
  const dto = { businessId: 'b1', planId: 'plan1', phoneNumber: '90123456' };

  it('rejects a user who does not own the business', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(
      service.initiateSubscriptionPayment('u1', dto),
    ).rejects.toThrow(AppException);
    expect(t.prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown plan id', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(
      service.initiateSubscriptionPayment('u1', dto),
    ).rejects.toThrow(AppException);
  });

  it('never sends the client-controlled amount to FedaPay -- always the plan price', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.subscriptionPlan.findUnique.mockResolvedValue(PLAN);
    t.prisma.subscription.create.mockResolvedValue({ id: 'sub1' });
    t.prisma.payment.create.mockResolvedValue({ id: 'pay1' });
    t.fedaPayClient.createTransaction.mockResolvedValue({ id: '123' });
    t.fedaPayClient.generateCheckout.mockResolvedValue({
      token: 'tok',
      url: 'https://fedapay.com/checkout',
    });
    t.fedaPayClient.sendMobileMoneyPush.mockResolvedValue({});

    const service = await t.build();
    await service.initiateSubscriptionPayment('u1', dto);

    expect(t.fedaPayClient.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 }),
    );
  });

  it('returns the mobile_money_push flow when the USSD push succeeds', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.subscriptionPlan.findUnique.mockResolvedValue(PLAN);
    t.prisma.subscription.create.mockResolvedValue({ id: 'sub1' });
    t.prisma.payment.create.mockResolvedValue({ id: 'pay1' });
    t.fedaPayClient.createTransaction.mockResolvedValue({ id: '123' });
    t.fedaPayClient.generateCheckout.mockResolvedValue({
      token: 'tok',
      url: 'https://fedapay.com/checkout',
    });
    t.fedaPayClient.sendMobileMoneyPush.mockResolvedValue({});

    const service = await t.build();
    const result = await service.initiateSubscriptionPayment('u1', dto);

    expect(result.flow).toBe('mobile_money_push');
    expect(result.checkoutUrl).toBe('https://fedapay.com/checkout');
  });

  it('falls back to hosted_checkout on the same transaction when the USSD push fails', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.subscriptionPlan.findUnique.mockResolvedValue(PLAN);
    t.prisma.subscription.create.mockResolvedValue({ id: 'sub1' });
    t.prisma.payment.create.mockResolvedValue({ id: 'pay1' });
    t.fedaPayClient.createTransaction.mockResolvedValue({ id: '123' });
    t.fedaPayClient.generateCheckout.mockResolvedValue({
      token: 'tok',
      url: 'https://fedapay.com/checkout',
    });
    t.fedaPayClient.sendMobileMoneyPush.mockRejectedValue(
      new Error('push timeout'),
    );

    const service = await t.build();
    const result = await service.initiateSubscriptionPayment('u1', dto);

    expect(result.flow).toBe('hosted_checkout');
    expect(result.checkoutUrl).toBe('https://fedapay.com/checkout');
  });

  it('marks the payment FAILED and the subscription CANCELED when transaction creation fails', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.subscriptionPlan.findUnique.mockResolvedValue(PLAN);
    t.prisma.subscription.create.mockResolvedValue({ id: 'sub1' });
    t.prisma.payment.create.mockResolvedValue({ id: 'pay1' });
    t.fedaPayClient.createTransaction.mockRejectedValue(
      new Error('provider down'),
    );

    const service = await t.build();
    await expect(
      service.initiateSubscriptionPayment('u1', dto),
    ).rejects.toThrow('provider down');
    expect(t.prisma.$transaction).toHaveBeenCalled();
    expect(t.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
    expect(t.prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELED' } }),
    );
  });
});

describe('PaymentService.handleFedaPayWebhook', () => {
  it('ignores events other than transaction.approved', async () => {
    const t = buildTestModule();
    t.fedaPayClient.constructWebhookEvent.mockReturnValue({
      name: 'transaction.created',
    });

    const service = await t.build();
    const result = await service.handleFedaPayWebhook('{}', 'sig');
    expect(result).toEqual({ received: true, ignored: true });
  });

  it('rejects a malformed transaction id', async () => {
    const t = buildTestModule();
    t.fedaPayClient.constructWebhookEvent.mockReturnValue({
      name: 'transaction.approved',
      object_id: 'not-a-number',
    });

    const service = await t.build();
    await expect(service.handleFedaPayWebhook('{}', 'sig')).rejects.toThrow(
      AppException,
    );
  });

  it('rejects a transaction with no matching PaymentTransaction row', async () => {
    const t = buildTestModule();
    t.fedaPayClient.constructWebhookEvent.mockReturnValue({
      id: 'evt1',
      name: 'transaction.approved',
      object_id: '123',
    });
    t.prisma.paymentTransaction.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(service.handleFedaPayWebhook('{}', 'sig')).rejects.toThrow(
      AppException,
    );
  });

  it('returns duplicate:true without re-processing an already-succeeded payment', async () => {
    const t = buildTestModule();
    t.fedaPayClient.constructWebhookEvent.mockReturnValue({
      id: 'evt1',
      name: 'transaction.approved',
      object_id: '123',
    });
    t.prisma.paymentTransaction.findUnique.mockResolvedValue({
      id: 'pt1',
      paymentId: 'pay1',
      payment: { status: 'SUCCEEDED', amount: 5000, subscriptionId: 'sub1' },
    });

    const service = await t.build();
    const result = await service.handleFedaPayWebhook('{}', 'sig');
    expect(result).toEqual({ received: true, duplicate: true });
    expect(t.fedaPayClient.retrieveTransaction).not.toHaveBeenCalled();
  });

  it('rejects when the confirmed amount does not match the recorded payment amount', async () => {
    const t = buildTestModule();
    t.fedaPayClient.constructWebhookEvent.mockReturnValue({
      id: 'evt1',
      name: 'transaction.approved',
      object_id: '123',
    });
    t.prisma.paymentTransaction.findUnique.mockResolvedValue({
      id: 'pt1',
      paymentId: 'pay1',
      payment: { status: 'PENDING', amount: 5000, subscriptionId: 'sub1' },
    });
    t.fedaPayClient.retrieveTransaction.mockResolvedValue({
      id: '123',
      status: 'approved',
      amount: 9999,
      custom_metadata: { omni_payment_id: 'pay1' },
    });

    const service = await t.build();
    await expect(service.handleFedaPayWebhook('{}', 'sig')).rejects.toThrow(
      AppException,
    );
  });

  it('rejects when the transaction metadata points at a different payment', async () => {
    const t = buildTestModule();
    t.fedaPayClient.constructWebhookEvent.mockReturnValue({
      id: 'evt1',
      name: 'transaction.approved',
      object_id: '123',
    });
    t.prisma.paymentTransaction.findUnique.mockResolvedValue({
      id: 'pt1',
      paymentId: 'pay1',
      payment: { status: 'PENDING', amount: 5000, subscriptionId: 'sub1' },
    });
    t.fedaPayClient.retrieveTransaction.mockResolvedValue({
      id: '123',
      status: 'approved',
      amount: 5000,
      custom_metadata: { omni_payment_id: 'someone-elses-payment' },
    });

    const service = await t.build();
    await expect(service.handleFedaPayWebhook('{}', 'sig')).rejects.toThrow(
      AppException,
    );
  });

  it('activates the subscription when everything matches', async () => {
    const t = buildTestModule();
    t.fedaPayClient.constructWebhookEvent.mockReturnValue({
      id: 'evt1',
      name: 'transaction.approved',
      object_id: '123',
    });
    t.prisma.paymentTransaction.findUnique.mockResolvedValue({
      id: 'pt1',
      paymentId: 'pay1',
      payment: { status: 'PENDING', amount: 5000, subscriptionId: 'sub1' },
    });
    t.fedaPayClient.retrieveTransaction.mockResolvedValue({
      id: '123',
      status: 'approved',
      amount: 5000,
      custom_metadata: { omni_payment_id: 'pay1' },
    });

    const service = await t.build();
    const result = await service.handleFedaPayWebhook('{}', 'sig');

    expect(result).toEqual({ received: true, processed: true });
    expect(t.prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub1' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(t.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUCCEEDED' } }),
    );
  });
});
