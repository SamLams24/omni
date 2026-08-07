import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/token.service';
import { SubscriptionService } from './subscription.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List available subscription plans' })
  listPlans() {
    return this.subscriptionService.listPlans();
  }

  @Get('mine')
  @ApiOperation({ summary: "List the current user's own subscriptions" })
  listMine(@CurrentUser() user: AccessTokenPayload) {
    return this.subscriptionService.listOwnedBy(user.sub);
  }

  @Permissions('subscriptions.read')
  @Get()
  @ApiOperation({ summary: 'List every subscription (admin)' })
  listAll() {
    return this.subscriptionService.listAll();
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription owned by the current user' })
  cancel(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.subscriptionService.cancel(id, user.sub);
  }
}
