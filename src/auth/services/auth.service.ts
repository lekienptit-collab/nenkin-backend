import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ErrorCode } from 'src/common/constatns/error';
import { ROLE_TYPE } from 'src/common/constatns/role';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { RoleEntity } from 'src/entities/role.entity';
import { UserEntity } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import { LoginDto } from '../dto/login.dto';
import { LoginRes } from '../response/token.res';
import { SessionService } from './session.service';

export const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private roleRepo: Repository<RoleEntity>,
    private sessionService: SessionService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.createAdminUser();
  }

  async login(payload: LoginDto, agent?: string, ip?: string): Promise<LoginRes> {
    // password co select:false nen phai addSelect thu cong.
    const user = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .addSelect('u.password')
      .where('u.username = :login OR u.email = :login', {
        login: payload.username,
      })
      .getOne();

    if (!user) {
      throw new CBadRequestException(ErrorCode.CAN_NOT_LOGIN, { from: 1 });
    }
    if (!user.isActive) {
      throw new CBadRequestException(ErrorCode.USER_HAS_BANNED, { from: 1 });
    }
    if (!bcrypt.compareSync(payload.password, user.password)) {
      throw new CBadRequestException(ErrorCode.CAN_NOT_LOGIN, { from: 2 });
    }

    return this.sessionService.createTokenLogin(user, agent, ip);
  }

  /**
   * Tạo tài khoản admin đầu tiên nếu DB chưa có user nào.
   * Thông tin lấy từ ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD.
   */
  async createAdminUser() {
    const roleAdmin = await this.roleRepo.findOne({
      where: { slug: ROLE_TYPE.ADMIN },
    });
    if (!roleAdmin) {
      // RoleModule chưa seed xong, thử lại sau.
      setTimeout(() => this.createAdminUser(), 1000);
      return;
    }

    const userCount = await this.userRepo.count();
    if (userCount > 0) {
      return;
    }

    const username = this.configService.get<string>('app.adminUsername');
    const email = this.configService.get<string>('app.adminEmail');
    const password = this.configService.get<string>('app.adminPassword');

    await this.userRepo.insert({
      username,
      email,
      password: bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS),
      roleId: roleAdmin.id,
      isActive: true,
      isSuperUser: true,
      fullname: 'Administrator',
    });
    this.logger.log(`Created default admin user: ${username}`);
  }
}
