import { HttpException, HttpStatus } from '@nestjs/common';

export class CNotFoundException extends HttpException {
  constructor(
    message: string,
    objectOrError?: string | Record<string, any> | any,
    description = 'Not Found',
  ) {
    const data = {
      msg: message,
      data: objectOrError,
    };
    super(
      HttpException.createBody(data, description, HttpStatus.NOT_FOUND),
      HttpStatus.NOT_FOUND,
    );
  }
}
