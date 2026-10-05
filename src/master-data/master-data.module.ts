import { Module } from '@nestjs/common';
import { OcrModule } from 'src/ocr/ocr.module';
import { MasterDataController } from './master-data.controller';
import { PostalCodeService } from './postal-code.service';
import { ReferenceDataService } from './reference-data.service';
import { TaxOfficeService } from './tax-office.service';

@Module({
  imports: [OcrModule],
  controllers: [MasterDataController],
  providers: [PostalCodeService, ReferenceDataService, TaxOfficeService],
  exports: [TaxOfficeService],
})
export class MasterDataModule {}
