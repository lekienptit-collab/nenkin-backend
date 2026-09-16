import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { RoleEntity } from 'src/entities/role.entity';
import { SessionEntity } from 'src/entities/session.entity';
import { UserEntity } from 'src/entities/user.entity';
import { RoleModule } from 'src/roles/roles.module';
import { HealthController } from './health.controller';
import { MeController } from './me.controller';
import { UserService } from './services/users.service';
import { UserSearchController } from './user-search.controller';
import { UserController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RoleEntity, SessionEntity]),
    AuthModule,
    RoleModule,
  ],
  controllers: [
    UserController,
    MeController,
    UserSearchController,
    HealthController,
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
