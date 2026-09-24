import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import {
  NenkinServiceType,
  WorkerCaseType,
} from 'src/common/constatns/master-data';

export class CreateNenkinProcedureDto {
  @ApiProperty({ enum: NenkinServiceType, description: '1 = lần 1, 2 = lần 2' })
  @Type(() => Number)
  @IsEnum(NenkinServiceType)
  serviceType: NenkinServiceType;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  workerId: number;

  @ApiProperty({
    required: false,
    description:
      'Bắt buộc khi về nước hẳn; người quay lại Nhật tự khai nên bỏ trống',
  })
  @ValidateIf((o) => o.caseType !== WorkerCaseType.RETURN_JAPAN)
  @Type(() => Number)
  @IsInt()
  agentId?: number;

  @ApiProperty({
    required: false,
    enum: WorkerCaseType,
    default: WorkerCaseType.RETURN_HOME,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(WorkerCaseType)
  caseType?: WorkerCaseType;

  @ApiProperty({
    required: false,
    description:
      'Quan hệ với người được uỷ quyền; bỏ trống khi người lao động quay lại Nhật',
  })
  @ValidateIf((o) => o.caseType !== WorkerCaseType.RETURN_JAPAN)
  @IsString()
  @IsNotEmpty()
  relation?: string;

  // ----- Chỉ dùng cho lần 1 -----
  @ApiProperty({ required: false, description: 'Ngày làm đơn (lần 1)' })
  @ValidateIf((o) => o.serviceType === NenkinServiceType.FIRST)
  @IsDateString()
  requestDate?: string;

  @ApiProperty({ required: false, description: 'Ngày uỷ quyền (lần 1)' })
  @ValidateIf((o) => o.serviceType === NenkinServiceType.FIRST)
  @IsDateString()
  entrustDate?: string;

  // ----- Chỉ dùng cho lần 2 -----
  @ApiProperty({ required: false, description: 'Ngày làm đơn khai thuế' })
  @ValidateIf((o) => o.serviceType === NenkinServiceType.SECOND)
  @IsDateString()
  taxRequestDate?: string;

  @ApiProperty({ required: false, description: 'Ngày uỷ quyền khai thuế' })
  @ValidateIf((o) => o.serviceType === NenkinServiceType.SECOND)
  @IsDateString()
  taxEntrustDate?: string;

  @ApiProperty({ required: false, description: 'Văn phòng thuế (税務署)' })
  @IsOptional()
  @IsString()
  taxOffice?: string;

  @ApiProperty({
    required: false,
    description:
      'Ngày có kết quả Nenkin lần 1, ghi đè lên hồ sơ người lao động',
  })
  @IsOptional()
  @IsDateString()
  resultDate1?: string;
}

export class GetProceduresDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  workerId?: number;

  @ApiProperty({ required: false, enum: NenkinServiceType })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(NenkinServiceType)
  serviceType?: NenkinServiceType;
}
