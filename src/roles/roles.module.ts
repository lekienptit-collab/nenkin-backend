import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from 'src/entities/role.entity';
import { UserEntity } from 'src/entities/user.entity';
import { RoleController } from './roles.controller';
import { InitRoleService } from './services/ini_role.service';
import { RoleService } from './services/roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, UserEntity])],
  providers: [InitRoleService, RoleService],
  controllers: [RoleController],
  exports: [RoleService, InitRoleService],
})
export class RoleModule {}
