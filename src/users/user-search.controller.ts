import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TokenGuard } from 'src/common/decorator/auth.decorator';
import { UserService } from './services/users.service';

@ApiTags('Users')
@Controller('users-search')
@ApiBearerAuth()
export class UserSearchController {
  constructor(private readonly service: UserService) {}

  @Get()
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Tim nhanh user cho select box' })
  async search(
    @Query('keyword') keyword?: string,
    @Query('roleId') roleId?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.service.search(
      keyword,
      roleId ? parseInt(roleId, 10) : undefined,
      excludeId,
    );
  }
}
