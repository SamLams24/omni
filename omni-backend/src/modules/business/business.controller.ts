import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/token.service';
import { BusinessService } from './business.service';
import { BboxQueryDto } from './dto/bbox-query.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List OMNI businesses within a bounding box' })
  findInBbox(@Query() bbox: BboxQueryDto) {
    return this.businessService.findInBbox(bbox);
  }

  @Permissions('businesses.read')
  @Get('mine')
  @ApiOperation({ summary: "List the current user's own businesses" })
  listMine(@CurrentUser() user: AccessTokenPayload) {
    return this.businessService.listOwnedBy(user.sub);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single business by id' })
  findOne(@Param('id') id: string) {
    return this.businessService.findById(id);
  }

  @Permissions('businesses.create')
  @Post()
  @ApiOperation({ summary: 'Create (claim) a new OMNI business' })
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateBusinessDto,
  ) {
    return this.businessService.create(user.sub, dto);
  }

  @Permissions('businesses.update')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a business owned by the current user' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessService.update(id, user.sub, dto);
  }
}
