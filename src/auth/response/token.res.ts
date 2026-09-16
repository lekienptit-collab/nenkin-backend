import { ApiProperty } from '@nestjs/swagger';

export class LoginRes {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  expiresAt: number;
}
