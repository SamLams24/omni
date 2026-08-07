import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FedaPay, Requestor, Transaction, Webhook } from 'fedapay';
import { AppException, ErrorCode } from '../../common/errors/error-codes';
import { isTrustedFedaPayCheckoutUrl } from './fedapay.util';

Requestor.setHttpClient(axios.create({ timeout: 8000 }));

const API_BASE_URLS: Record<string, string> = {
  live: 'https://api.fedapay.com/v1',
  sandbox: 'https://sandbox-api.fedapay.com/v1',
};

export type FedaPayCheckout = { token: string; url: string };

/**
 * Thin wrapper around the official `fedapay` SDK, ported from
 * apps/web/src/lib/fedapay.js. All FedaPay-specific error handling funnels
 * through AppException so the rest of the app never has to know this is
 * FedaPay under the hood.
 */
@Injectable()
export class FedaPayClientService {
  private readonly logger = new Logger(FedaPayClientService.name);

  constructor(private readonly config: ConfigService) {}

  private configure(): void {
    const apiKey = this.config.get<string>('FEDAPAY_SECRET_KEY')?.trim();
    const environment =
      this.config.get<string>('FEDAPAY_ENVIRONMENT') ?? 'sandbox';

    if (!apiKey || !API_BASE_URLS[environment]) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.PAYMENT_FAILED,
        "Le fournisseur de paiement n'est pas configuré.",
      );
    }

    FedaPay.setApiKey(apiKey);
    FedaPay.setEnvironment(environment);
  }

  private async run<T>(request: () => Promise<T>): Promise<T> {
    try {
      this.configure();
      return await request();
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      this.logger.warn(`FedaPay request failed: ${String(error)}`);
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.PAYMENT_FAILED,
        'La requête FedaPay a échoué.',
      );
    }
  }

  createTransaction(params: Record<string, unknown>): Promise<Transaction> {
    return this.run(() => Transaction.create(params));
  }

  retrieveTransaction(transactionId: string): Promise<Transaction> {
    return this.run(() => Transaction.retrieve(transactionId));
  }

  async generateCheckout(transaction: Transaction): Promise<FedaPayCheckout> {
    const checkout = await this.run(() => transaction.generateToken());
    const token: unknown = (checkout as { token?: unknown }).token;
    const url: unknown = (checkout as { url?: unknown }).url;
    if (
      typeof token !== 'string' ||
      token.length < 1 ||
      token.length > 2048 ||
      !isTrustedFedaPayCheckoutUrl(url)
    ) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.PAYMENT_FAILED,
        'FedaPay a renvoyé un lien de paiement invalide.',
      );
    }
    return { token, url: url as string };
  }

  sendMobileMoneyPush(
    transaction: Transaction,
    params: { token: string; phoneNumber: string },
  ): Promise<unknown> {
    return this.run(() =>
      transaction.sendNowWithToken('moov_tg', params.token, {
        phone_number: { number: params.phoneNumber, country: 'tg' },
      }),
    );
  }

  /**
   * Verifies the HMAC signature (via the SDK, not hand-rolled crypto) and
   * timestamp tolerance, throwing AppException on any mismatch. Returns the
   * parsed event on success.
   */
  constructWebhookEvent(
    rawBody: string,
    signatureHeader: string | undefined,
  ): unknown {
    const secret = this.config.get<string>('FEDAPAY_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.PAYMENT_FAILED,
        "Le secret du webhook FedaPay n'est pas configuré.",
      );
    }
    if (!signatureHeader) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Signature de webhook manquante.',
      );
    }
    try {
      return Webhook.constructEvent(rawBody, signatureHeader, secret);
    } catch {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Signature de webhook invalide.',
      );
    }
  }
}
