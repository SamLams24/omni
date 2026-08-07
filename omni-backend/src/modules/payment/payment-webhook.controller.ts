import { Controller, Headers, HttpStatus, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { AppException, ErrorCode } from '../../common/errors/error-codes';
import { PaymentService } from './payment.service';

@ApiExcludeController()
@Controller('payments/fedapay')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Public()
  @SkipCsrf() // authenticated by FedaPay's HMAC signature, not a session cookie
  @Post('webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-fedapay-signature') signature: string | undefined,
  ) {
    if (!req.rawBody) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Corps de requête manquant.',
      );
    }
    return this.paymentService.handleFedaPayWebhook(
      req.rawBody.toString('utf8'),
      signature,
    );
  }
}
