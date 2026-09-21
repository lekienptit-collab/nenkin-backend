import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { BankAccountType } from 'src/common/constatns/master-data';
import { EmptyToNull } from 'src/common/validator/empty-to-null';

const JP_POSTAL_CODE = /^\d{3}-\d{4}$/;

export class CreateAgentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nameFurigana?: string;

  @ApiProperty({ required: false, example: '080-8045-0561' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false, example: '会社員' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiProperty({ required: false, example: '三菱UFJ' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false, example: '小田井' })
  @IsOptional()
  @IsString()
  bankBranchName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({ required: false, enum: BankAccountType })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(BankAccountType)
  bankAccountType?: BankAccountType;

  @ApiProperty({ required: false, example: '123-4567' })
  @EmptyToNull()
  @IsOptional()
  @Matches(JP_POSTAL_CODE, { message: 'Mã bưu điện phải có dạng 123-4567' })
  addressPostalCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressDetail?: string;
}

export class UpdateAgentDto extends PartialType(CreateAgentDto) {}

export class GetManyAgentDto {
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

  @ApiProperty({ required: false, description: 'Tên hoặc số điện thoại' })
  @IsOptional()
  @IsString()
  keyword?: string;
}

export class SearchAgentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyword?: string;
}
