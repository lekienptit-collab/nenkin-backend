import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetManyRoleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ required: false, description: 'lọc theo tên role cha' })
  @IsOptional()
  @IsString()
  parent?: string;
}

export class SearchRoleDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  slug?: string | string[];
}
