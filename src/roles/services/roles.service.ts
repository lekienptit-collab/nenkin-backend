import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ErrorCode } from 'src/common/constatns/error';
import {
  ALL_PERMISSIONS,
  PERMISSION_ALL,
  ROLE_TYPE,
} from 'src/common/constatns/role';
import { UserIdentity } from 'src/common/decorator/auth.decorator';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { RoleEntity } from 'src/entities/role.entity';
import { UserEntity } from 'src/entities/user.entity';
import { In, Like, Not, Repository } from 'typeorm';
import { SearchRoleDto } from '../dto/get_many_role.dto';

export interface GetManyRolesOptions {
  page?: number;
  limit?: number;
  name?: string;
  slug?: string;
  parent?: string;
}

export interface GetManyRolesResult {
  data: RoleEntity[];
  total: number;
  count: number;
  page: number;
  pageCount: number;
}

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly repo: Repository<RoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /** Danh sach role co phan trang, kem role cha. */
  async getManyRoles(
    _user?: UserIdentity,
    options: GetManyRolesOptions = {},
  ): Promise<GetManyRolesResult> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;

    const where: Record<string, any> = {};
    if (options.name) {
      where.name = Like(`%${options.name.trim()}%`);
    }
    if (options.slug) {
      where.slug = Like(`%${options.slug.trim()}%`);
    }
    if (options.parent) {
      where.parent = { name: Like(`%${options.parent.trim()}%`) };
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      relations: ['parent'],
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      count: data.length,
      page,
      pageCount: Math.ceil(total / limit),
    };
  }

  /** Tim nhanh role theo slug, dung cho cac o select o frontend. */
  async searchRoles(params: SearchRoleDto): Promise<RoleEntity[]> {
    const where: Record<string, any> = { isActive: true };
    if (params?.slug) {
      const slugs = Array.isArray(params.slug) ? params.slug : [params.slug];
      where.slug = In(slugs);
    }
    return this.repo.find({ where, order: { id: 'ASC' } });
  }

  async findBySlug(slug: string, excludeId?: number): Promise<RoleEntity> {
    const where: Record<string, any> = { slug };
    if (excludeId) {
      where.id = Not(excludeId);
    }
    return this.repo.findOne({ where });
  }

  async getRoleAdmin(): Promise<RoleEntity> {
    return this.repo.findOne({ where: { slug: ROLE_TYPE.ADMIN } });
  }

  async getRoleById(id: number): Promise<RoleEntity> {
    if (!id) return null;
    return this.repo.findOne({ where: { id }, relations: ['parent'] });
  }

  async save(role: RoleEntity): Promise<RoleEntity> {
    return this.repo.save(role);
  }

  async softDelete(id: number): Promise<void> {
    await this.repo.softDelete(id);
  }

  /**
   * Tra ve role kem quyen toi da ma role cha cho phep.
   * Frontend dung permissionParent de khoa cac checkbox vuot quyen.
   */
  async getPermissionToCustomer(id: number): Promise<{
    id: number;
    name: string;
    slug: string;
    permissions: string[];
    permissionParent: string[];
  }> {
    const role = await this.repo.findOne({
      where: { id },
      relations: ['parent'],
    });
    if (!role) {
      throw new CBadRequestException(ErrorCode.ROLE_NOT_FOUND);
    }

    let permissionParent: string[] = [PERMISSION_ALL];
    if (role.parent) {
      permissionParent = role.parent.permissions?.length
        ? role.parent.permissions
        : [];
    }

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      permissions: role.permissions || [],
      permissionParent,
    };
  }

  /** Quyen toi da ma mot role duoc phep co (theo role cha). */
  async getAllowedPermissions(parentRoleId?: number): Promise<string[]> {
    if (!parentRoleId) {
      return ALL_PERMISSIONS;
    }
    const parent = await this.repo.findOne({ where: { id: parentRoleId } });
    if (!parent) {
      return ALL_PERMISSIONS;
    }
    if (parent.permissions?.includes(PERMISSION_ALL)) {
      return ALL_PERMISSIONS;
    }
    return parent.permissions || [];
  }

  /** Cat bot permission vuot qua quyen cua role cha. */
  async normalizePermissions(
    permissions: string[] = [],
    parentRoleId?: number,
  ): Promise<string[]> {
    if (permissions.includes(PERMISSION_ALL) && !parentRoleId) {
      return [PERMISSION_ALL];
    }
    const allowed = await this.getAllowedPermissions(parentRoleId);
    const allowedSet = new Set(allowed);
    const expanded = permissions.includes(PERMISSION_ALL)
      ? ALL_PERMISSIONS
      : permissions;
    return expanded.filter((p) => allowedSet.has(p));
  }

  /**
   * Sau khi thu hep quyen cua mot role, cac role con khong duoc giu quyen
   * ma cha da mat.
   */
  async syncChildrenPermissions(roleId: number, permissions: string[]) {
    const children = await this.repo.find({ where: { roleId } });
    if (children.length === 0) return;

    const allowed = permissions.includes(PERMISSION_ALL)
      ? ALL_PERMISSIONS
      : permissions;
    const allowedSet = new Set(allowed);

    for (const child of children) {
      const current = child.permissions?.includes(PERMISSION_ALL)
        ? ALL_PERMISSIONS
        : child.permissions || [];
      const next = current.filter((p) => allowedSet.has(p));
      if (next.length !== current.length) {
        await this.repo.update(child.id, { permissions: next });
        await this.syncChildrenPermissions(child.id, next);
      }
    }
  }

  async countUsersOfRole(roleId: number): Promise<number> {
    return this.userRepo.count({ where: { roleId } });
  }

  async countChildren(roleId: number): Promise<number> {
    return this.repo.count({ where: { roleId } });
  }
}
