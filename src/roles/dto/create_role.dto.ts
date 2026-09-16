import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ required: true, example: 'Kế toán' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: true, example: 'ke-toan' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-_]+$/, {
    message: 'slug chỉ gồm chữ thường, số, dấu - và _',
  })
  slug: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  permissions?: string[];

  @ApiProperty({ required: false, description: 'id của role cha' })
  @IsOptional()
  roleId?: number;
}
