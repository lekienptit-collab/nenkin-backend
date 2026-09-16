import { ApiProperty } from '@nestjs/swagger';

export class ProfileRes {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullname?: string;

  @ApiProperty()
  phone?: string;

  @ApiProperty()
  address?: string;

  @ApiProperty()
  avatar?: string;

  @ApiProperty()
  birthday?: Date;

  @ApiProperty()
  note?: string;

  @ApiProperty()
  isActive?: boolean;

  @ApiProperty()
  isSuperUser?: boolean;

  @ApiProperty()
  isAdmin?: boolean;

  @ApiProperty()
  roleId?: number;

  @ApiProperty()
  role?: string;

  @ApiProperty()
  roleName?: string;

  @ApiProperty({ type: [String] })
  permissions?: string[];
}
