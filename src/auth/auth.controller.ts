import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RealIP } from 'src/common/decorator/ip.decorator';
import { LoginDto } from './dto/login.dto';
import { LoginRes } from './response/token.res';
import { AuthService } from './services/auth.service';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ description: 'Đăng nhập bằng username hoặc email' })
  async login(
    @RealIP() ip: string,
    @Body() payload: LoginDto,
    @Req() request: Request,
  ): Promise<LoginRes> {
    return this.authService.login(payload, request.get('user-agent'), ip);
  }
}
