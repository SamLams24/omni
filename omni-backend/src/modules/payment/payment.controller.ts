import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/token.service';
import { PaymentService } from './payment.service';
import { CreateSubscriptionPaymentDto } from './dto/create-subscription-payment.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('subscriptions')
  @ApiOperation({
    summary:
      'Start a FedaPay-backed premium subscription payment (USSD push, with hosted-checkout fallback) for a business the current user owns',
  })
  initiateSubscription(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateSubscriptionPaymentDto,
  ) {
    return this.paymentService.initiateSubscriptionPayment(user.sub, dto);
  }
}
