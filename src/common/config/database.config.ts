import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const slowQueryThreshold = parseInt(
    process.env.SLOW_QUERY_THRESHOLD || '1000',
    10,
  );
  const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || '30', 10);

  return {
    type: process.env.DATABASE_TYPE || 'mysql',
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: +process.env.DATABASE_PORT || 33061,
    username: process.env.DATABASE_USERNAME || 'root',
    password: process.env.DATABASE_PASSWROD || 'nenkin',
    database: process.env.DATABASE_NAME || 'nenkin',
    // Base project: bật synchronize để tự tạo bảng lần chạy đầu.
    // Khi dự án đã lên thật thì tắt đi và dùng migration.
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING !== 'false' ? true : ['error'],
    maxQueryExecutionTime: slowQueryThreshold,
    extra: {
      connectionLimit: poolSize,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 10000,
    },
  };
});
