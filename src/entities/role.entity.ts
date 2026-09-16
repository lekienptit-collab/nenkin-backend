import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn('increment')
  @ApiProperty()
  id?: number;

  @Column({ unique: true })
  @ApiProperty()
  slug?: string;

  @Column()
  @ApiProperty()
  name?: string;

  /**
   * Danh sách quyền của role. Dùng 'all' để gán toàn quyền.
   */
  @Column('simple-array', { nullable: true })
  @ApiProperty({ type: [String] })
  permissions?: string[];

  /**
   * false với các role mặc định của hệ thống (không cho sửa tên/slug, không cho xoá).
   */
  @Column({ name: 'is_can_edit', default: true })
  @ApiProperty()
  isCanEdit?: boolean;

  @Column({ name: 'is_active', default: true })
  @ApiProperty()
  isActive?: boolean;

  @OneToMany(() => UserEntity, (m) => m.role)
  users?: UserEntity[];

  @Column({ name: 'role_id', nullable: true })
  @ApiProperty()
  roleId?: number;

  @ManyToOne(() => RoleEntity, (role) => role.children)
  @JoinColumn({ name: 'role_id' })
  parent?: RoleEntity;

  @OneToMany(() => RoleEntity, (role) => role.parent)
  children?: RoleEntity[];

  @CreateDateColumn({ name: 'create_at' })
  createAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
