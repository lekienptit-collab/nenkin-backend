import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleEntity } from './role.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id?: string;

  @Column({ unique: true })
  @ApiProperty()
  username: string;

  @Column({ unique: true })
  @ApiProperty()
  email?: string;

  @Exclude()
  @Column({ select: false })
  password?: string;

  @Column({ name: 'is_active', default: true })
  @ApiProperty()
  isActive?: boolean;

  @Column({ name: 'role_id', nullable: true })
  @ApiProperty()
  roleId?: number;

  @ManyToOne(() => RoleEntity, (r) => r.users)
  @JoinColumn({ name: 'role_id' })
  role?: RoleEntity;

  @Column({ nullable: true })
  @ApiProperty()
  fullname?: string;

  @Column({ nullable: true })
  @ApiProperty()
  phone?: string;

  @Column({ nullable: true })
  @ApiProperty()
  address?: string;

  @Column({ nullable: true, type: 'date' })
  @ApiProperty()
  birthday?: Date;

  @Column({ nullable: true })
  @ApiProperty()
  avatar?: string;

  @Column({ nullable: true, type: 'text' })
  @ApiProperty()
  note?: string;

  @Column({ name: 'is_super_user', default: false })
  @ApiProperty()
  isSuperUser?: boolean;

  @CreateDateColumn({ name: 'create_at' })
  createAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
