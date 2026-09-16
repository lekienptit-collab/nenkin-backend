import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Cache } from 'cache-manager';
import { BCRYPT_SALT_ROUNDS } from 'src/auth/services/auth.service';
import { SessionService } from 'src/auth/services/session.service';
import { ErrorCode } from 'src/common/constatns/error';
import { PERMISSION_ALL, ROLE_TYPE } from 'src/common/constatns/role';
import { UserIdentity } from 'src/common/decorator/auth.decorator';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { RoleEntity } from 'src/entities/role.entity';
import { UserEntity } from 'src/entities/user.entity';
import { GrantData } from 'src/roles/services/ini_role.service';
import { In, Like, Not, Repository } from 'typeorm';
import { BanUserDto } from '../dto/ban-user.dto';
import { CreateUserDto } from '../dto/create_user.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { UpdateMePasswordDto } from '../dto/update-password.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ProfileRes } from '../response/profile.res';

export interface GetManyUsersOptions {
  page?: number;
  limit?: number;
  username?: string;
  email?: string;
  fullname?: string;
  phone?: string;
  roleId?: number;
  isActive?: boolean;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    private readonly sessionService: SessionService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getMany(options: GetManyUsersOptions = {}) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0 ? Math.min(options.limit, 200) : 20;

    const where: Record<string, any> = {};
    if (options.username) where.username = Like(`%${options.username.trim()}%`);
    if (options.email) where.email = Like(`%${options.email.trim()}%`);
    if (options.fullname) where.fullname = Like(`%${options.fullname.trim()}%`);
    if (options.phone) where.phone = Like(`%${options.phone.trim()}%`);
    if (options.roleId) where.roleId = options.roleId;
    if (typeof options.isActive === 'boolean') {
      where.isActive = options.isActive;
    }

    const [data, total] = await this.userRepo.findAndCount({
      where,
      relations: ['role', 'role.parent'],
      order: { createAt: 'DESC' },
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

  /** Tim nhanh user, dung cho select box o frontend. */
  async search(keyword?: string, roleId?: number, excludeId?: string) {
    const base: Record<string, any> = {};
    if (roleId) base.roleId = roleId;
    if (excludeId) base.id = Not(excludeId);

    const where = keyword
      ? [
          { ...base, username: Like(`%${keyword}%`) },
          { ...base, email: Like(`%${keyword}%`) },
          { ...base, fullname: Like(`%${keyword}%`) },
        ]
      : base;

    const data = await this.userRepo.find({
      where,
      relations: ['role'],
      take: 50,
      order: { username: 'ASC' },
    });
    return { data, total: data.length };
  }

  async getOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role', 'role.parent'],
    });
    if (!user) {
      throw new CBadRequestException(ErrorCode.USER_NOT_FOUND);
    }
    return user;
  }

  private async assertRoleExists(roleId: number): Promise<RoleEntity> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new CBadRequestException(ErrorCode.ROLE_NOT_FOUND);
    }
    return role;
  }

  private async assertUniqueUsername(username: string, excludeId?: string) {
    const where: Record<string, any> = { username };
    if (excludeId) where.id = Not(excludeId);
    const existed = await this.userRepo.findOne({ where });
    if (existed) {
      throw new CBadRequestException(ErrorCode.HAVE_USERNAME);
    }
  }

  private async assertUniqueEmail(email: string, excludeId?: string) {
    const where: Record<string, any> = { email };
    if (excludeId) where.id = Not(excludeId);
    const existed = await this.userRepo.findOne({ where });
    if (existed) {
      throw new CBadRequestException(ErrorCode.HAVE_EMAIL);
    }
  }

  async createUser(payload: CreateUserDto): Promise<UserEntity> {
    await this.assertUniqueUsername(payload.username);
    await this.assertUniqueEmail(payload.email);
    await this.assertRoleExists(payload.roleId);

    const user = this.userRepo.create({
      username: payload.username,
      email: payload.email,
      password: bcrypt.hashSync(payload.password, BCRYPT_SALT_ROUNDS),
      roleId: payload.roleId,
      fullname: payload.fullname,
      phone: payload.phone,
      address: payload.address,
      birthday: payload.birthday,
      note: payload.note,
      isActive: payload.isActive ?? true,
    });

    const saved = await this.userRepo.save(user);
    return this.getOne(saved.id);
  }

  async updateUser(id: string, payload: UpdateUserDto): Promise<UserEntity> {
    const user = await this.getOne(id);

    if (payload.email && payload.email !== user.email) {
      await this.assertUniqueEmail(payload.email, id);
      user.email = payload.email;
    }
    if (payload.roleId && payload.roleId !== user.roleId) {
      await this.assertRoleExists(payload.roleId);
      user.roleId = payload.roleId;
    }
    if (payload.password) {
      user.password = bcrypt.hashSync(payload.password, BCRYPT_SALT_ROUNDS);
      // Doi mat khau thi cac phien cu phai dang nhap lai.
      await this.sessionService.deleteAllToken(id);
    }

    if (payload.fullname !== undefined) user.fullname = payload.fullname;
    if (payload.phone !== undefined) user.phone = payload.phone;
    if (payload.address !== undefined) user.address = payload.address;
    if (payload.birthday !== undefined) user.birthday = payload.birthday;
    if (payload.note !== undefined) user.note = payload.note;
    if (payload.isActive !== undefined) {
      user.isActive = payload.isActive;
      if (!payload.isActive) {
        await this.sessionService.deleteAllToken(id);
      }
    }

    await this.userRepo.save(user);
    return this.getOne(id);
  }

  async updateBan(id: string, payload: BanUserDto, currentUserId?: string) {
    if (id === currentUserId) {
      throw new CBadRequestException(ErrorCode.CAN_NOT_BAN_YOURSELF);
    }
    const user = await this.getOne(id);
    await this.userRepo.update(user.id, { isActive: payload.isActive });
    if (!payload.isActive) {
      await this.sessionService.deleteAllToken(id);
    }
    return { success: true };
  }

  async deleteMulti(ids: string[], currentUserId?: string) {
    if (currentUserId && ids.includes(currentUserId)) {
      throw new CBadRequestException(ErrorCode.CAN_NOT_DELETE_YOURSELF);
    }
    const users = await this.userRepo.find({ where: { id: In(ids) } });
    for (const u of users) {
      await this.sessionService.deleteAllToken(u.id);
    }
    await this.userRepo.softDelete({ id: In(ids) });
    return { success: true };
  }

  /** Thong tin tai khoan dang dang nhap, kem permission da resolve. */
  async fetchProfile(identity: UserIdentity): Promise<ProfileRes> {
    const user = await this.getOne(identity.sub);
    const permissions = await this.getPermissions(user.roleId);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      phone: user.phone,
      address: user.address,
      avatar: user.avatar,
      birthday: user.birthday,
      note: user.note,
      isActive: user.isActive,
      isSuperUser: user.isSuperUser,
      isAdmin: user.role?.slug === ROLE_TYPE.ADMIN,
      roleId: user.roleId,
      role: user.role?.slug,
      roleName: user.role?.name,
      permissions,
    };
  }

  async getPermissions(roleId?: number): Promise<string[]> {
    if (!roleId) return [];
    const grants = await this.cacheManager.get<GrantData>('roles_grants');
    const grantOfRole = grants?.[roleId.toString()];
    if (grantOfRole) {
      return Object.keys(grantOfRole);
    }
    // Cache chua co thi doc thang DB.
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    return role?.permissions || [];
  }

  async updateMe(id: string, payload: UpdateMeDto): Promise<UserEntity> {
    const user = await this.getOne(id);
    if (payload.email && payload.email !== user.email) {
      await this.assertUniqueEmail(payload.email, id);
      user.email = payload.email;
    }
    if (payload.fullname !== undefined) user.fullname = payload.fullname;
    if (payload.phone !== undefined) user.phone = payload.phone;
    if (payload.address !== undefined) user.address = payload.address;
    if (payload.birthday !== undefined) user.birthday = payload.birthday;
    if (payload.avatar !== undefined) user.avatar = payload.avatar;
    if (payload.note !== undefined) user.note = payload.note;

    await this.userRepo.save(user);
    return this.getOne(id);
  }

  async updatePassword(id: string, payload: UpdateMePasswordDto) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id })
      .getOne();
    if (!user) {
      throw new CBadRequestException(ErrorCode.USER_NOT_FOUND);
    }
    if (!bcrypt.compareSync(payload.oldPassword, user.password)) {
      throw new CBadRequestException(ErrorCode.WRONG_PASSWORD);
    }

    await this.userRepo.update(id, {
      password: bcrypt.hashSync(payload.newPassword, BCRYPT_SALT_ROUNDS),
    });
    await this.sessionService.deleteAllToken(id);
    return { success: true };
  }

  /** true neu permission cua user bao gom quyen can kiem tra. */
  hasPermission(pers: string[] = [], permission: string): boolean {
    return pers.includes(PERMISSION_ALL) || pers.includes(permission);
  }
}
