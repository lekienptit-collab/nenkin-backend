import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { ErrorCode } from 'src/common/constatns/error';
import { JWT_LIFETIME, JWT_LOG_OUT } from 'src/common/constatns/jwt';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { makeRandomString } from 'src/common/util/string';
import { SessionEntity } from 'src/entities/session.entity';
import { UserEntity } from 'src/entities/user.entity';
import { IsNull, Repository } from 'typeorm';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { LoginRes } from '../response/token.res';

@Injectable()
export class SessionService {
  private readonly logger: Logger = new Logger(SessionService.name);

  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER)
    protected cacheManager: Cache,
  ) {}

  private buildPayload(user: UserEntity) {
    return {
      sub: user.id,
      un: user.username,
      role: user?.role?.id || user?.roleId || '',
      // jti lam moi token la duy nhat. Khong co no thi 2 lan dang nhap trong cung
      // mot giay se sinh ra JWT giong het nhau (payload chi khac o iat/exp tinh
      // theo giay), khien viec thu hoi 1 token lam chet luon phien con lai.
      jti: makeRandomString(16, 'Aa#'),
    };
  }

  async createTokenLogin(
    user: UserEntity,
    agent?: string,
    ip?: string,
  ): Promise<LoginRes> {
    const refreshToken = `${makeRandomString(60, 'Aa#')}.${user.id}`;
    const token = this.jwtService.sign(this.buildPayload(user));

    const session = new SessionEntity();
    session.refreshToken = refreshToken;
    session.token = token;
    session.ip = ip;
    session.agent = agent;
    session.userId = user.id;
    await this.sessionRepo.save(session);

    const decode = this.jwtService.decode(token);
    return {
      accessToken: token,
      refreshToken,
      expiresIn: JWT_LIFETIME,
      expiresAt: decode['exp'],
    };
  }

  async refreshToken(payload: RefreshDto): Promise<LoginRes> {
    const tokens = payload.refreshToken.split('.');
    if (!tokens || tokens.length !== 2) {
      throw new CBadRequestException(ErrorCode.REFRESH_TOKEN_WRONG);
    }

    const session = await this.sessionRepo.findOne({
      where: {
        userId: tokens[1],
        refreshToken: payload.refreshToken,
        deletedAt: IsNull(),
      },
    });
    if (!session) {
      throw new CBadRequestException(ErrorCode.REFRESH_TOKEN_WRONG);
    }

    const user = await this.userRepo.findOne({
      where: { id: session.userId },
      relations: ['role'],
    });
    if (!user || !user.isActive) {
      throw new CBadRequestException(ErrorCode.REFRESH_TOKEN_WRONG);
    }

    const refreshToken = `${makeRandomString(60, 'Aa#')}.${user.id}`;
    const token = this.jwtService.sign(this.buildPayload(user));

    // token cũ không dùng được nữa
    await this.cacheManager.set(`${JWT_LOG_OUT}.${session.token}`, JWT_LOG_OUT);
    await this.sessionRepo.update(session.id, {
      refreshToken,
      token,
      updatedAt: new Date(),
    });

    const decode = this.jwtService.decode(token);
    return {
      accessToken: token,
      refreshToken,
      expiresIn: JWT_LIFETIME,
      expiresAt: decode['exp'],
    };
  }

  async deleteToken(payload: LogoutDto): Promise<void> {
    const decode = this.jwtService.decode(payload.token);
    if (!decode || !decode['sub']) {
      return;
    }

    const session = await this.sessionRepo.findOne({
      where: {
        userId: decode['sub'],
        token: payload.token,
        deletedAt: IsNull(),
      },
    });

    if (session) {
      await this.sessionRepo.softDelete(session.id);
      await this.cacheManager.set(
        `${JWT_LOG_OUT}.${payload.token}`,
        JWT_LOG_OUT,
      );
    }
  }

  /** Thu hồi toàn bộ phiên của user (dùng khi khoá tài khoản / đổi mật khẩu). */
  async deleteAllToken(userId: string): Promise<void> {
    const sessions = await this.sessionRepo.find({
      where: { userId, deletedAt: IsNull() },
    });
    for (const s of sessions) {
      await this.cacheManager.set(`${JWT_LOG_OUT}.${s.token}`, JWT_LOG_OUT);
    }
    if (sessions.length > 0) {
      await this.sessionRepo.softDelete({ userId });
    }
  }
}
