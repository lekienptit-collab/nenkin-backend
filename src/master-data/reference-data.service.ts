import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import { JP_PREFECTURES } from 'src/common/constatns/master-data';
import { PostalData } from './jp-address';
import {
  AreaRule,
  parseJurisdiction,
  TaxOfficeRecord,
} from './tax-office-matcher';

/** Sở thuế kèm mã tỉnh và luật khu vực đã tách sẵn. */
export interface TaxOfficeEntry {
  office: TaxOfficeRecord & { prefectureCode: string };
  rules: AreaRule[];
}

/**
 * Dữ liệu tham chiếu đóng gói trong `assets/reference/`, dựng bằng
 * `scripts/build-reference-data.js` từ nguồn chính thức (日本郵便, 国税庁).
 *
 * Nạp lần đầu khi có người dùng tới rồi giữ trong bộ nhớ: file mã bưu điện
 * giải nén ra ~18MB, không cần đọc lại mỗi lần tra.
 */
@Injectable()
export class ReferenceDataService {
  private readonly logger = new Logger(ReferenceDataService.name);
  private postal?: PostalData;
  private taxOffices?: TaxOfficeEntry[];

  private path(file: string) {
    return join(process.cwd(), 'assets', 'reference', file);
  }

  get postalData(): PostalData {
    if (!this.postal) {
      const raw = gunzipSync(
        readFileSync(this.path('jp-postal-codes.json.gz')),
      );
      this.postal = JSON.parse(raw.toString('utf8')).prefectures;
      this.logger.log('Đã nạp dữ liệu mã bưu điện');
    }
    return this.postal;
  }

  get taxOfficeEntries(): TaxOfficeEntry[] {
    if (!this.taxOffices) {
      const { offices } = JSON.parse(
        readFileSync(this.path('tax-offices.json'), 'utf8'),
      ) as { offices: TaxOfficeRecord[] };
      this.taxOffices = offices.map((office) => ({
        office: {
          ...office,
          prefectureCode:
            JP_PREFECTURES.find((p) => p.label === office.prefecture)?.value ||
            '',
        },
        rules: parseJurisdiction(office.jurisdiction),
      }));
      this.logger.log(`Đã nạp ${offices.length} sở thuế`);
    }
    return this.taxOffices;
  }
}
