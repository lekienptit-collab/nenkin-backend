import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolePers } from 'src/common/constatns/role';
import {
  CurrentUser,
  TokenGuard,
  UserIdentity,
} from 'src/common/decorator/auth.decorator';
import { RolesGuard } from 'src/common/decorator/roles.guard';
import { CUseRoles } from 'src/common/decorator/user.role';
import { IdsStringDto } from 'src/common/dto/ids.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { CreateUserDto } from './dto/create_user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './services/users.service';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get()
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_USER)
  @ApiOperation({ description: 'Danh sach thanh vien (phan trang)' })
  async getMany(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('username') username?: string,
    @Query('email') email?: string,
    @Query('fullname') fullname?: string,
    @Query('phone') phone?: string,
    @Query('roleId') roleId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.getMany({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      username,
      email,
      fullname,
      phone,
      roleId: roleId ? parseInt(roleId, 10) : undefined,
      isActive:
        isActive === undefined || isActive === '' ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_USER)
  async getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.CREATE_USER)
  async createOne(@Body() payload: CreateUserDto) {
    return this.service.createUser(payload);
  }

  @Patch(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.UPDATE_USER)
  async updateOne(@Param('id') id: string, @Body() payload: UpdateUserDto) {
    return this.service.updateUser(id, payload);
  }

  @Patch('/ban/:id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.BANED_USER)
  @ApiOperation({ description: 'Khoa / mo khoa tai khoan' })
  async updateBan(
    @Param('id') id: string,
    @Body() payload: BanUserDto,
    @CurrentUser() user: UserIdentity,
  ) {
    return this.service.updateBan(id, payload, user?.sub);
  }

  @Delete('/')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.DELETE_USER)
  @ApiOperation({ description: 'Xoa nhieu thanh vien' })
  async delete(
    @Body() payload: IdsStringDto,
    @CurrentUser() user: UserIdentity,
  ) {
    return this.service.deleteMulti(payload.ids, user?.sub);
  }
}
