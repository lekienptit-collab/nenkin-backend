import { ApiProperty } from '@nestjs/swagger';
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
import { BankAccountType } from 'src/common/constatns/master-data';
import { UserEntity } from './user.entity';

/**
 * Người đại diện (người được người lao động uỷ quyền làm thủ tục ở Nhật).
 * Thông tin ở đây được in lên giấy uỷ quyền và tờ khai thuế.
 */
@Entity('agents')
export class AgentEntity {
  @PrimaryGeneratedColumn('increment')
  @ApiProperty()
  id?: number;

  @Column()
  @ApiProperty()
  name: string;

  @Column({ name: 'name_furigana', nullable: true })
  @ApiProperty()
  nameFurigana?: string;

  @Column({ name: 'phone_number', nullable: true })
  @ApiProperty()
  phoneNumber?: string;

  @Column({ nullable: true })
  @ApiProperty()
  occupation?: string;

  // ----- Tài khoản ngân hàng -----
  @Column({ name: 'bank_name', nullable: true })
  @ApiProperty()
  bankName?: string;

  @Column({ name: 'bank_branch_name', nullable: true })
  @ApiProperty()
  bankBranchName?: string;

  @Column({ name: 'bank_account_name', nullable: true })
  @ApiProperty()
  bankAccountName?: string;

  @Column({ name: 'bank_account_number', nullable: true })
  @ApiProperty()
  bankAccountNumber?: string;

  @Column({ name: 'bank_account_type', type: 'tinyint', nullable: true })
  @ApiProperty({ enum: BankAccountType })
  bankAccountType?: BankAccountType;

  // ----- Địa chỉ ở Nhật -----
  @Column({ name: 'address_postal_code', nullable: true })
  @ApiProperty()
  addressPostalCode?: string;

  @Column({ name: 'address_detail', nullable: true })
  @ApiProperty()
  addressDetail?: string;

  // ----- Metadata -----
  @Column({ name: 'created_by', nullable: true })
  @ApiProperty()
  createdById?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: UserEntity;

  @Column({ name: 'updated_by', nullable: true })
  @ApiProperty()
  updatedById?: string;

  @CreateDateColumn({ name: 'create_at' })
  createAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
