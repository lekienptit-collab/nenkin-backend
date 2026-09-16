import {
  CACHE_MANAGER,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cache } from 'cache-manager';
import { PERMISSION_ALL } from '../constatns/role';
import { GrantData } from 'src/roles/services/ini_role.service';

/**
 * Đối chiếu permission của role hiện tại (cache trong Redis) với @CUseRoles().
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles || roles.length === 0) {
      return true;
    }

    const grants = await this.cacheManager.get<GrantData>('roles_grants');
    const { user } = context.switchToHttp().getRequest();

    const role = user?.role || '';
    if (role === '') {
      return false;
    }

    const userRole = grants?.[role.toString()];
    if (!userRole) {
      return false;
    }
    if (userRole[PERMISSION_ALL]) {
      return true;
    }
    for (const r of roles) {
      if (userRole[r.toString()]) {
        return true;
      }
    }
    return false;
  }
}
