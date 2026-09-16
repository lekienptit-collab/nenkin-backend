import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  token: string;
}
