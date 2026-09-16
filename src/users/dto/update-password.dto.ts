import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateMePasswordDto {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ required: true, minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
