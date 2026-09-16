import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class BanUserDto {
  @ApiProperty({ required: true, description: 'false = khoá tài khoản' })
  @IsBoolean()
  isActive: boolean;
}
