import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { PostalCodeService } from './postal-code.service';

@Module({
  controllers: [MasterDataController],
  providers: [PostalCodeService],
})
export class MasterDataModule {}
