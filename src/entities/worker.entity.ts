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
import { Gender, NenkinResult } from 'src/common/constatns/master-data';
import { UserEntity } from './user.entity';
import { WorkerInsuranceHistoryEntity } from './worker-insurance-history.entity';

/**
 * Người lao động - hồ sơ gốc dùng để làm thủ tục Nenkin.
 *
 * Các nhóm thông tin bám theo từng mục trên form:
 * cá nhân/hộ chiếu -> địa chỉ -> thẻ ngoại kiều -> sổ Nenkin -> ngân hàng ->
 * thuế -> quá trình tham gia BHXH -> kết quả Nenkin.
 */
@Entity('workers')
export class WorkerEntity {
  @PrimaryGeneratedColumn('increment')
  @ApiProperty()
  id?: number;

  // ----- Thông tin cá nhân -----
  @Column()
  @ApiProperty()
  name: string;

  /** Họ tên phiên âm Katakana, in trên sổ Nenkin. */
  @Column({ name: 'name_furigana', nullable: true })
  @ApiProperty()
  nameFurigana?: string;

  @Column({ type: 'tinyint', nullable: true })
  @ApiProperty({ enum: Gender })
  gender?: Gender;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  @ApiProperty()
  dateOfBirth?: string;

  @Column({ name: 'phone_number', nullable: true })
  @ApiProperty()
  phoneNumber?: string;

  @Column({ default: 'Việt Nam' })
  @ApiProperty()
  country?: string;

  @Column({ name: 'leave_japan_date', type: 'date', nullable: true })
  @ApiProperty()
  leaveJapanDate?: string;

  @Column({ name: 'occupation', nullable: true })
  @ApiProperty()
  occupation?: string;

  // ----- Ảnh hộ chiếu -----
  @Column({ name: 'passport_first_page', nullable: true })
  @ApiProperty()
  passportFirstPage?: string;

  @Column({ name: 'passport_second_page', nullable: true })
  @ApiProperty()
  passportSecondPage?: string;

  @Column({ name: 'passport_stamp_page', nullable: true })
  @ApiProperty()
  passportStampPage?: string;

  /** Giấy tờ chứng minh đã rời Nhật Bản (住民票の除票の写し等). */
  @Column({ name: 'left_proof_url', nullable: true })
  @ApiProperty()
  leftProofUrl?: string;

  // ----- Địa chỉ hiện tại (Việt Nam) -----
  @Column({ name: 'address_vn_prefecture_code', nullable: true })
  @ApiProperty()
  addressVnPrefectureCode?: string;

  @Column({ name: 'address_vn_district', nullable: true })
  @ApiProperty()
  addressVnDistrict?: string;

  @Column({ name: 'address_vn_postal_code', nullable: true })
  @ApiProperty()
  addressVnPostalCode?: string;

  @Column({ name: 'address_vn_address', length: 100, nullable: true })
  @ApiProperty()
  addressVnAddress?: string;

  // ----- Địa chỉ cuối cùng ở Nhật -----
  @Column({ name: 'address_jp_postal_code', nullable: true })
  @ApiProperty()
  addressJpPostalCode?: string;

  @Column({ name: 'address_jp_prefecture_code', nullable: true })
  @ApiProperty()
  addressJpPrefectureCode?: string;

  @Column({ name: 'address_jp_district', nullable: true })
  @ApiProperty()
  addressJpDistrict?: string;

  @Column({ name: 'address_jp_house_number', nullable: true })
  @ApiProperty()
  addressJpHouseNumber?: string;

  // ----- Thẻ ngoại kiều -----
  @Column({ name: 'residence_card_front_image', nullable: true })
  @ApiProperty()
  residenceCardFrontImage?: string;

  @Column({ name: 'residence_card_back_image', nullable: true })
  @ApiProperty()
  residenceCardBackImage?: string;

  // ----- Sổ Nenkin -----
  /** Mã số lương hưu cơ sở, dạng 1234-123456. */
  @Column({ name: 'pension_number', nullable: true })
  @ApiProperty()
  pensionNumber?: string;

  @Column({ name: 'nenkin_book_image', nullable: true })
  @ApiProperty()
  nenkinBookImage?: string;

  // ----- Tài khoản ngân hàng -----
  @Column({ name: 'bank_country', nullable: true })
  @ApiProperty()
  bankCountry?: string;

  @Column({ name: 'bank_name', nullable: true })
  @ApiProperty()
  bankName?: string;

  @Column({ name: 'bank_branch_name', nullable: true })
  @ApiProperty()
  bankBranchName?: string;

  @Column({ name: 'bank_swift_code', nullable: true })
  @ApiProperty()
  bankSwiftCode?: string;

  @Column({ name: 'bank_branch_address', nullable: true })
  @ApiProperty()
  bankBranchAddress?: string;

  @Column({ name: 'bank_city', nullable: true })
  @ApiProperty()
  bankCity?: string;

  @Column({ name: 'bank_account_name', nullable: true })
  @ApiProperty()
  bankAccountName?: string;

  @Column({ name: 'bank_account_name_furigana', nullable: true })
  @ApiProperty()
  bankAccountNameFurigana?: string;

  @Column({ name: 'bank_account_number', nullable: true })
  @ApiProperty()
  bankAccountNumber?: string;

  @Column({ name: 'bank_image', nullable: true })
  @ApiProperty()
  bankImage?: string;

  @Column({ name: 'bank_image_back', nullable: true })
  @ApiProperty()
  bankImageBack?: string;

  // ----- Thông tin thuế (đơn vị: yên) -----
  @Column({
    name: 'tax_deduct',
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
  })
  @ApiProperty()
  taxDeduct?: string;

  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
  })
  @ApiProperty()
  taxAmount?: string;

  @Column({
    name: 'net_pension',
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
  })
  @ApiProperty()
  netPension?: string;

  @OneToMany(() => WorkerInsuranceHistoryEntity, (h) => h.worker, {
    cascade: true,
  })
  insuranceHistories?: WorkerInsuranceHistoryEntity[];

  // ----- Kết quả Nenkin -----
  @Column({ name: 'result_date_1', type: 'date', nullable: true })
  @ApiProperty()
  resultDate1?: string;

  @Column({ name: 'result_date_2', type: 'date', nullable: true })
  @ApiProperty()
  resultDate2?: string;

  @Column({ name: 'nenkin_first_result', type: 'tinyint', default: 0 })
  @ApiProperty({ enum: NenkinResult })
  nenkinFirstResult?: NenkinResult;

  @Column({ name: 'nenkin_second_result', type: 'tinyint', default: 0 })
  @ApiProperty({ enum: NenkinResult })
  nenkinSecondResult?: NenkinResult;

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

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy?: UserEntity;

  @CreateDateColumn({ name: 'create_at' })
  createAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
