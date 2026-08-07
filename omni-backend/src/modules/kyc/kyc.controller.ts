import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/token.service';
import { KycService } from './kyc.service';
import { CreateKycRequestDto } from './dto/create-kyc-request.dto';
import { RejectKycRequestDto } from './dto/reject-kyc-request.dto';

@ApiTags('kyc')
@Controller('kyc/requests')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post()
  @ApiOperation({
    summary:
      'Submit (or update) a KYC verification request for a business the current user owns',
  })
  submit(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateKycRequestDto,
  ) {
    return this.kycService.submit(user.sub, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: "List the current user's own KYC requests" })
  listMine(@CurrentUser() user: AccessTokenPayload) {
    return this.kycService.listOwnedBy(user.sub);
  }

  @Permissions('kyc.read')
  @Get()
  @ApiOperation({ summary: 'List every KYC request (admin/moderator)' })
  listAll() {
    return this.kycService.listAll();
  }

  @Permissions('kyc.approve')
  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve a KYC request, promoting the business to CONFIRMED',
  })
  approve(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.kycService.approve(id, user.sub);
  }

  @Permissions('kyc.reject')
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a KYC request with a reason' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: RejectKycRequestDto,
  ) {
    return this.kycService.reject(id, user.sub, dto.reason);
  }
}
