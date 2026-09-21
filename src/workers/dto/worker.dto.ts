import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EmptyToNull } from 'src/common/validator/empty-to-null';
import {
  Gender,
  NenkinResult,
  NenkinServiceType,
  PaperStatus,
} from 'src/common/constatns/master-data';
import { MAX_INSURANCE_HISTORY } from 'src/entities/worker-insurance-history.entity';

/** Mã bưu điện Nhật: 3 số - 4 số. */
const JP_POSTAL_CODE = /^\d{3}-\d{4}$/;
/** Mã số lương hưu cơ sở: 4 số - 6 số. */
const PENSION_NUMBER = /^\d{4}-\d{6}$/;

export class InsuranceHistoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  workPlace?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class CreateWorkerDto {
  // ----- Thông tin cá nhân -----
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nameFurigana?: string;

  @ApiProperty({ required: false, enum: Gender })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false, default: 'Việt Nam' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  leaveJapanDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  occupation?: string;

  // ----- Ảnh giấy tờ -----
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  passportFirstPage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  passportSecondPage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  passportStampPage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  leftProofUrl?: string;

  // ----- Địa chỉ hiện tại (Việt Nam) -----
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressVnPrefectureCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressVnDistrict?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressVnPostalCode?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressVnAddress?: string;

  // ----- Địa chỉ cuối cùng ở Nhật -----
  @ApiProperty({ required: false, example: '321-4522' })
  @EmptyToNull()
  @IsOptional()
  @Matches(JP_POSTAL_CODE, { message: 'Mã bưu điện phải có dạng 123-4567' })
  addressJpPostalCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressJpPrefectureCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressJpDistrict?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressJpHouseNumber?: string;

  // ----- Thẻ ngoại kiều -----
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  residenceCardFrontImage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  residenceCardBackImage?: string;

  // ----- Sổ Nenkin -----
  @ApiProperty({ required: false, example: '1234-123456' })
  @EmptyToNull()
  @IsOptional()
  @Matches(PENSION_NUMBER, {
    message: 'Mã số lương hưu phải có dạng 1234-123456',
  })
  pensionNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nenkinBookImage?: string;

  // ----- Ngân hàng -----
  @ApiProperty({ required: false, description: "'81' Nhật, '84' Việt Nam" })
  @IsOptional()
  @IsString()
  bankCountry?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankBranchName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankSwiftCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankBranchAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankCity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountNameFurigana?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankImage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankImageBack?: string;

  // ----- Thuế -----
  @ApiProperty({ required: false, description: 'Số tiền được miễn đánh thuế' })
  @EmptyToNull()
  @IsOptional()
  @IsNumberString({ no_symbols: true })
  taxDeduct?: string;

  @ApiProperty({ required: false, description: 'Số tiền thuế phải nộp' })
  @EmptyToNull()
  @IsOptional()
  @IsNumberString({ no_symbols: true })
  taxAmount?: string;

  @ApiProperty({ required: false, description: 'Tiền hưu trí thực lĩnh' })
  @EmptyToNull()
  @IsOptional()
  @IsNumberString({ no_symbols: true })
  netPension?: string;

  @ApiProperty({ required: false, type: [InsuranceHistoryDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INSURANCE_HISTORY)
  @ValidateNested({ each: true })
  @Type(() => InsuranceHistoryDto)
  insuranceHistories?: InsuranceHistoryDto[];

  // ----- Kết quả Nenkin -----
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  resultDate1?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  resultDate2?: string;
}

export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {}

export class UpdateNenkinResultDto {
  @ApiProperty({ enum: NenkinServiceType })
  @Type(() => Number)
  @IsEnum(NenkinServiceType)
  serviceType: NenkinServiceType;

  @ApiProperty({ enum: NenkinResult })
  @Type(() => Number)
  @IsEnum(NenkinResult)
  result: NenkinResult;

  @ApiProperty({ required: false, description: 'Ngày trả kết quả' })
  @IsOptional()
  @IsDateString()
  resultDate?: string;
}

export class GetManyWorkerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiProperty({ required: false, description: 'Tên / mã số Nenkin / SĐT' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ required: false, description: 'Id nhân viên đã tạo hồ sơ' })
  @IsOptional()
  @IsString()
  createdById?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({ required: false, enum: PaperStatus })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(PaperStatus)
  firstPaperStatus?: PaperStatus;

  @ApiProperty({ required: false, enum: PaperStatus })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(PaperStatus)
  secondPaperStatus?: PaperStatus;

  @ApiProperty({ required: false, enum: NenkinResult })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(NenkinResult)
  nenkinFirstResult?: NenkinResult;

  @ApiProperty({ required: false, enum: NenkinResult })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(NenkinResult)
  nenkinSecondResult?: NenkinResult;

  /**
   * Lọc nhanh theo trạng thái hồ sơ, không phân biệt lần 1 hay lần 2:
   * - NOT_CREATED / INCOMPLETE: ít nhất một lần đang ở trạng thái đó
   * - COMPLETE: cả hai lần đều đủ giấy tờ
   */
  @ApiProperty({ required: false, enum: PaperStatus })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(PaperStatus)
  paperStatus?: PaperStatus;

  /** true = chỉ lấy người lao động còn thiếu thông tin bắt buộc. */
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasLackingInfo?: boolean;
}

export class SearchWorkerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyword?: string;
}
