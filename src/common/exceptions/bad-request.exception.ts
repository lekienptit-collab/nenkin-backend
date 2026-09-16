import { HttpException, HttpStatus } from '@nestjs/common';

export class CBadRequestException extends HttpException {
  constructor(
    message: string,
    objectOrError?: string | Record<string, any> | any,
    description = 'Bad Request',
  ) {
    const data = {
      msg: message,
      data: objectOrError,
    };
    super(
      HttpException.createBody(data, description, HttpStatus.BAD_REQUEST),
      HttpStatus.BAD_REQUEST,
    );
  }
}
