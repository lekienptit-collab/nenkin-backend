import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: +process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: +process.env.REDIS_DB || 0,
}));

export interface RedisInterface {
  host: string;
  port: number;
  password: string | undefined;
  db: number;
}
