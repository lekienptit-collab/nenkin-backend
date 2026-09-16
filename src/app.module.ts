import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as redisStore from 'cache-manager-redis-store';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import configuration from './common/config';
import { RoleModule } from './roles/roles.module';
import { UserModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: configuration,
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (c: ConfigService) => {
        const configDatabase = c.get<TypeOrmModuleOptions>('database');
        return {
          ...configDatabase,
          autoLoadEntities: true,
          entities: [join(__dirname, '**/**.entity{.ts,.js}')],
        } as TypeOrmModuleOptions;
      },
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (c: ConfigService) => ({
        host: c.get<string>('redis.host'),
        port: c.get<number>('redis.port'),
        password: c.get<string | null>('redis.password'),
        db: c.get<number>('redis.db'),
        store: redisStore,
        ttl: 600,
      }),
      isGlobal: true,
      inject: [ConfigService],
    }),
    RoleModule,
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
