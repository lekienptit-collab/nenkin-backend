import { config } from 'dotenv';

config();

import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: +process.env.DATABASE_PORT || 33062,
  username: process.env.DATABASE_USERNAME || 'root',
  password: process.env.DATABASE_PASSWROD || 'nenkin',
  database: process.env.DATABASE_NAME || 'nenkin',
  entities: ['src/**/*.entity.ts'],
  logging: true,
  synchronize: false,
  migrationsRun: false,
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  migrationsTableName: 'history',
});

// Chu y: file nay chi duoc export DUY NHAT 1 DataSource.
// Them `export default AppDataSource` se lam TypeORM CLI bao loi
// "Given data source file must contain only one export of DataSource instance".
