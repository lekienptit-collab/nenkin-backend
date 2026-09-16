import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { RoleEntity } from 'src/entities/role.entity';
import { Repository } from 'typeorm';
import { roleData } from '../data';

/** { roleId: { permission: true } } */
export type GrantData = Record<string, Record<string, boolean>>;

export const CACHE_KEY_GRANTS = 'roles_grants';
export const CACHE_KEY_ROLES = 'roles';

/**
 * Seed role mặc định và nạp bảng phân quyền vào Redis để RolesGuard đọc.
 * Gọi lại reload() mỗi khi role/permission thay đổi.
 */
@Injectable()
export class InitRoleService implements OnModuleInit {
  private readonly logger = new Logger(InitRoleService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private roleRepo: Repository<RoleEntity>,
    @Inject(CACHE_MANAGER)
    protected cacheManager: Cache,
  ) {}

  async onModuleInit() {
    await this.seed();
    await this.reload();
  }

  async seed() {
    const roleCount = await this.roleRepo.count();
    if (roleCount === 0) {
      await this.roleRepo.insert(roleData);
      this.logger.log(`Seeded ${roleData.length} default roles`);
    }
  }

  /** Nạp lại grants + danh sách role id vào cache. */
  async reload() {
    const roles = await this.roleRepo.find({ where: { isActive: true } });
    const grants: GrantData = {};
    const rolesMap: number[] = [];

    for (const rl of roles) {
      rolesMap.push(rl.id);
      if (rl.permissions && rl.permissions.length > 0) {
        for (const p of rl.permissions) {
          if (!grants[rl.id.toString()]) {
            grants[rl.id.toString()] = {};
          }
          grants[rl.id.toString()][p] = true;
        }
      }
    }

    await this.cacheManager.set(CACHE_KEY_GRANTS, grants, { ttl: 0 });
    await this.cacheManager.set(CACHE_KEY_ROLES, rolesMap, { ttl: 0 });
  }
}
