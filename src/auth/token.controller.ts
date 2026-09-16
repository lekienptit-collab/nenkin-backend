import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LoginRes } from './response/token.res';
import { SessionService } from './services/session.service';

@Controller('token')
@ApiTags('Auth')
export class TokenController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('refresh')
  @ApiOperation({ description: 'Cấp lại access token từ refresh token' })
  async refresh(@Body() payload: RefreshDto): Promise<LoginRes> {
    return this.sessionService.refreshToken(payload);
  }

  @Delete('')
  @ApiOperation({ description: 'Đăng xuất, vô hiệu hoá token hiện tại' })
  async deleteToken(@Body() payload: LogoutDto) {
    await this.sessionService.deleteToken(payload);
    return { success: true };
  }
}
