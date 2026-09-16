import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from 'src/common/constatns/jwt';
import { PERMISSION_ALL, ROLE_TYPE } from 'src/common/constatns/role';
import { RoleEntity } from 'src/entities/role.entity';
import { GrantData } from 'src/roles/services/ini_role.service';
import { Repository } from 'typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(RoleEntity)
    private roleRepo: Repository<RoleEntity>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  /** Gắn thêm permission + thông tin role vào request.user */
  async validate(payload: any) {
    const roleId = payload?.role || '';
    if (roleId === '') {
      return { ...payload, pers: [], isAdmin: false };
    }

    const grants = await this.cacheManager.get<GrantData>('roles_grants');
    const role = await this.roleRepo.findOne({
      where: { id: +roleId },
      relations: ['parent'],
    });

    const grantOfRole = grants?.[roleId.toString()] ?? {};
    const pers = Object.keys(grantOfRole);

    return {
      ...payload,
      pers: pers.includes(PERMISSION_ALL) ? [PERMISSION_ALL] : pers,
      isAdmin: role?.slug === ROLE_TYPE.ADMIN,
      parentRole: role?.parent
        ? {
            id: role.parent.id,
            slug: role.parent.slug,
            name: role.parent.name,
          }
        : undefined,
    };
  }
}
