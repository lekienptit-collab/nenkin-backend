import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Chuẩn hoá lỗi trả về FE: { msg, data }
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<any>();
    const status = exception.getStatus();
    const resEx = exception.getResponse();
    let msg = '';
    let data = null;

    const shouldLog =
      !`${request.url}`.includes('token') &&
      !`${request.url}`.includes('auth') &&
      exception.name !== 'ForbiddenException' &&
      exception.name !== 'UnauthorizedException';

    if (shouldLog) {
      this.logger.error(
        `${request.url} : ${exception.name} ${exception.message}`,
        exception.stack,
      );
    }

    if (typeof resEx === 'object') {
      const rEx: any = resEx;
      msg = rEx.error;
      if (rEx.msg) {
        msg = rEx.msg;
      }
      if (rEx.data) {
        data = rEx.data;
      }
      if (rEx.message) {
        if (typeof rEx.message === 'string') {
          msg = rEx.message;
        }
        if (typeof rEx.message === 'object' && !rEx.message.msg) {
          data = rEx.message;
        }
      }
    } else if (typeof resEx === 'string') {
      msg = resEx;
    }

    response.status(status).json({ msg, data });
  }
}
