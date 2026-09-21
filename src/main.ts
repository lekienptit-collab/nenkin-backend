import './env';
import {
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import { useContainer } from 'class-validator';
import { json, urlencoded } from 'express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { errFormat, filterError } from './common/util/filter-error';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.enableCors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
  });

  app.use(bodyParser.text({ type: 'text/html' }));
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new UnprocessableEntityException(
          errFormat('ValidationError', filterError(errors)),
        ),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<string>('app.port');

  // CHỈ thư mục ảnh được phục vụ tĩnh, vì thẻ <img> không gửi được token.
  // Tên file ảnh có phần ngẫu nhiên nên không đoán được đường dẫn.
  //
  // File PDF hồ sơ Nenkin KHÔNG phục vụ tĩnh: đường dẫn của chúng suy ra được
  // từ id người lao động, mà nội dung thì có họ tên, ngày sinh, số tài khoản,
  // mã số lương hưu. Muốn tải phải đi qua /nenkin/.../download (có kiểm tra quyền).
  const storageRoot = configService.get<string>('storage.root');
  const storagePublicPath = configService.get<string>('storage.publicPath');
  mkdirSync(join(storageRoot, 'uploads'), { recursive: true });
  app.useStaticAssets(join(storageRoot, 'uploads'), {
    prefix: `${storagePublicPath}/uploads`,
  });

  if (configService.get<boolean>('app.isSwagger')) {
    const options = new DocumentBuilder()
      .setTitle('Nenkin API')
      .setDescription('API backend Nenkin')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('swagger', app, document);
  }

  await app.listen(port, () => {
    console.log(`Nenkin backend started on port ${port}`);
    console.log(`Swagger: http://127.0.0.1:${port}/swagger`);
  });

  process.on('unhandledRejection', (e) => {
    console.error('unhandledRejection', e);
  });
  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap();
