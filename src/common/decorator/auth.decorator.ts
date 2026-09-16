import {
  CACHE_MANAGER,
  createParamDecorator,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Cache } from 'cache-manager';
import { JWT_LOG_OUT } from '../constatns/jwt';

export interface ParentRoleInfo {
  id: number;
  slug?: string;
  name?: string;
}

/** Payload sau khi JwtStrategy.validate() chạy xong, gắn vào request.user */
export interface UserIdentity {
  /** user id */
  sub: string;
  /** username */
  un?: string;
  /** role id */
  role?: number;
  /** danh sách permission đã resolve */
  pers?: string[];
  isAdmin?: boolean;
  parentRole?: ParentRoleInfo;
}

export const CurrentUser = createParamDecorator(
  (_, context: ExecutionContext) => {
    const { user } = context.switchToHttp().getRequest();
    return user;
  },
);

/**
 * Guard xác thực JWT, đồng thời chặn token đã logout (được đánh dấu trong Redis).
 */
@Injectable()
export class TokenGuard extends AuthGuard('jwt') {
  @Inject(CACHE_MANAGER)
  protected cacheManager: Cache;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);

    const authorization = request.headers?.authorization;
    if (!authorization || authorization === '') {
      throw new UnauthorizedException();
    }
    const tokens = authorization.split(' ');
    if (!tokens || tokens.length !== 2) {
      throw new UnauthorizedException();
    }

    const value = await this.cacheManager.get(`${JWT_LOG_OUT}.${tokens[1]}`);
    if (value && value === JWT_LOG_OUT) {
      throw new UnauthorizedException();
    }

    const ok = await super.canActivate(context);
    if (!ok) {
      throw new UnauthorizedException();
    }
    return true;
  }

  getRequest<T = any>(context: ExecutionContext): T {
    return context.switchToHttp().getRequest();
  }
}
