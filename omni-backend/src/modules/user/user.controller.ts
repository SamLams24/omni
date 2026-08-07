import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { UserService } from './user.service';

@ApiTags('admin-users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Permissions('users.read')
  @Get()
  @ApiOperation({ summary: 'List every user (admin)' })
  listAll() {
    return this.userService.listAll();
  }

  @Permissions('users.suspend')
  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend a user account' })
  suspend(@Param('id') id: string) {
    return this.userService.setActive(id, false);
  }

  @Permissions('users.suspend')
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended user account' })
  reactivate(@Param('id') id: string) {
    return this.userService.setActive(id, true);
  }
}
