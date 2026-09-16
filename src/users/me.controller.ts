import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  TokenGuard,
  UserIdentity,
} from 'src/common/decorator/auth.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateMePasswordDto } from './dto/update-password.dto';
import { ProfileRes } from './response/profile.res';
import { UserService } from './services/users.service';

@ApiBearerAuth()
@ApiTags('Me')
@Controller('me')
export class MeController {
  constructor(private readonly service: UserService) {}

  @Get()
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Thong tin tai khoan dang dang nhap' })
  async getMe(@CurrentUser() user: UserIdentity): Promise<ProfileRes> {
    return this.service.fetchProfile(user);
  }

  @Get('/permissions')
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Danh sach permission cua tai khoan hien tai' })
  async permissions(@CurrentUser() user: UserIdentity): Promise<string[]> {
    return this.service.getPermissions(user.role);
  }

  @Patch()
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Cap nhat thong tin ca nhan' })
  async updateMe(
    @CurrentUser() user: UserIdentity,
    @Body() payload: UpdateMeDto,
  ) {
    return this.service.updateMe(user.sub, payload);
  }

  @Patch('/password')
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Doi mat khau' })
  async updatePassword(
    @CurrentUser() user: UserIdentity,
    @Body() payload: UpdateMePasswordDto,
  ) {
    return this.service.updatePassword(user.sub, payload);
  }
}
