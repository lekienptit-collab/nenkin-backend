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
import { NenkinServiceType } from 'src/common/constatns/master-data';

export class CreateNenkinProcedureDto {
  @ApiProperty({ enum: NenkinServiceType, description: '1 = lần 1, 2 = lần 2' })
  @Type(() => Number)
  @IsEnum(NenkinServiceType)
  serviceType: NenkinServiceType;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  workerId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  agentId: number;

  @ApiProperty({ description: 'Quan hệ với người được uỷ quyền' })
  @IsString()
  @IsNotEmpty()
  relation: string;

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
