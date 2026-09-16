import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCode } from 'src/common/constatns/error';
import { PermissionGroup, RolePers } from 'src/common/constatns/role';
import {
  CurrentUser,
  TokenGuard,
  UserIdentity,
} from 'src/common/decorator/auth.decorator';
import { RolesGuard } from 'src/common/decorator/roles.guard';
import { CUseRoles } from 'src/common/decorator/user.role';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { RoleEntity } from 'src/entities/role.entity';
import { CreateRoleDto } from './dto/create_role.dto';
import { GetManyRoleDto, SearchRoleDto } from './dto/get_many_role.dto';
import { UpdateRoleDto } from './dto/update_role.dto';
import { InitRoleService } from './services/ini_role.service';
import { RoleService } from './services/roles.service';

@ApiTags('Roles')
@Controller('roles')
@ApiBearerAuth()
export class RoleController {
  constructor(
    private readonly service: RoleService,
    private readonly initRoleService: InitRoleService,
  ) {}

  @Get('/permissions')
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Danh sách permission theo nhóm' })
  async getPermission() {
    return PermissionGroup;
  }

  @Get('/search')
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Tìm role theo slug (dùng cho select box)' })
  async search(@Query() params: SearchRoleDto) {
    return this.service.searchRoles(params);
  }

  @Get('/permission-to-customer/:id')
  @UseGuards(TokenGuard)
  @ApiOperation({
    description: 'Lấy permission của role kèm giới hạn quyền của role cha',
  })
  async getPermissionToCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPermissionToCustomer(id);
  }

  @Get()
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_ROLES)
  @ApiOperation({ description: 'Danh sách role (phân trang)' })
  async getMany(
    @CurrentUser() user: UserIdentity,
    @Query() params: GetManyRoleDto,
  ) {
    return this.service.getManyRoles(user, {
      page: params?.page ? parseInt(params.page, 10) : undefined,
      limit: params?.limit ? parseInt(params.limit, 10) : undefined,
      name: params?.name,
      slug: params?.slug,
      parent: params?.parent,
    });
  }

  @Get(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_ROLES)
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const role = await this.service.getRoleById(id);
    if (!role) {
      throw new CBadRequestException(ErrorCode.ROLE_NOT_FOUND);
    }
    return role;
  }

  @Post()
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.CREATE_ROLES)
  async createOne(@Body() payload: CreateRoleDto) {
    const existed = await this.service.findBySlug(payload.slug);
    if (existed) {
      throw new CBadRequestException(ErrorCode.ROLE_SLUG_ALREADY_EXISTS);
    }

    let parentRoleId = payload.roleId;
    if (!parentRoleId) {
      const admin = await this.service.getRoleAdmin();
      parentRoleId = admin?.id;
    }

    const role = new RoleEntity();
    role.name = payload.name;
    role.slug = payload.slug;
    role.roleId = parentRoleId;
    role.isCanEdit = true;
    role.isActive = true;
    role.permissions = await this.service.normalizePermissions(
      payload.permissions || [],
      parentRoleId,
    );

    const created = await this.service.save(role);
    await this.initRoleService.reload();
    return created;
  }

  @Patch(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.UPDATE_ROLES)
  async updateOne(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateRoleDto,
  ) {
    const role = await this.service.getRoleById(id);
    if (!role) {
      throw new CBadRequestException(ErrorCode.ROLE_NOT_FOUND);
    }

    // Role mặc định chỉ được đổi permission, không đổi tên/slug.
    if (role.isCanEdit) {
      if (payload.name) role.name = payload.name;
      if (payload.slug && payload.slug !== role.slug) {
        const existed = await this.service.findBySlug(payload.slug, id);
        if (existed) {
          throw new CBadRequestException(ErrorCode.ROLE_SLUG_ALREADY_EXISTS);
        }
        role.slug = payload.slug;
      }
      if (payload.roleId !== undefined && payload.roleId !== id) {
        role.roleId = payload.roleId || null;
      }
    }

    if (payload.permissions) {
      role.permissions = await this.service.normalizePermissions(
        payload.permissions,
        role.roleId,
      );
    }

    const updated = await this.service.save(role);
    await this.service.syncChildrenPermissions(id, updated.permissions || []);
    await this.initRoleService.reload();
    return updated;
  }

  @Delete(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.DELETE_ROLES)
  async deleteOne(@Param('id', ParseIntPipe) id: number) {
    const role = await this.service.getRoleById(id);
    if (!role) {
      throw new CBadRequestException(ErrorCode.ROLE_NOT_FOUND);
    }
    if (!role.isCanEdit) {
      throw new CBadRequestException(ErrorCode.CAN_NOT_DELETE_ROLE);
    }
    const userCount = await this.service.countUsersOfRole(id);
    if (userCount > 0) {
      throw new CBadRequestException(ErrorCode.ROLE_HAS_USER, { userCount });
    }
    const childCount = await this.service.countChildren(id);
    if (childCount > 0) {
      throw new CBadRequestException(ErrorCode.CAN_NOT_DELETE_ROLE, {
        childCount,
      });
    }

    await this.service.softDelete(id);
    await this.initRoleService.reload();
    return { success: true };
  }
}
