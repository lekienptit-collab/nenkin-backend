import { Injectable, Logger } from '@nestjs/common';
import { get } from 'https';
import { ErrorCode } from 'src/common/constatns/error';
import { JP_PREFECTURES } from 'src/common/constatns/master-data';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { reverseLookup, ReverseLookupResult } from './jp-address';
import { ReferenceDataService } from './reference-data.service';

const ZIPCLOUD_URL = 'https://zipcloud.ibsnet.co.jp/api/search?zipcode=';
const REQUEST_TIMEOUT = 8000;

export interface PostalAddress {
  /** Mã tỉnh theo JIS, khớp với JP_PREFECTURES. */
  prefectureCode: string;
  prefectureName: string;
  /** 市区町村 + 町域, ghép lại để điền vào ô "Xã/Phường/Thị trấn". */
  district: string;
}

/**
 * Tra địa chỉ Nhật Bản từ mã bưu điện qua API công khai zipcloud.
 *
 * Gọi ở phía backend thay vì trình duyệt để tránh CORS và để giữ một chỗ
 * duy nhất xử lý lỗi khi dịch vụ ngoài không phản hồi.
 */
@Injectable()
export class PostalCodeService {
  private readonly logger = new Logger(PostalCodeService.name);

  constructor(private readonly referenceData: ReferenceDataService) {}

  /**
   * Chiều ngược lại: tra mã bưu điện từ địa chỉ. Thẻ ngoại kiều không in mã
   * bưu điện nên sau khi AI đọc địa chỉ từ thẻ, ô mã bưu điện vẫn trống.
   *
   * Dùng dữ liệu 日本郵便 đóng gói sẵn chứ không hỏi AI: AI hay bịa mã bưu
   * điện trông rất thật, mà mã này in thẳng lên tờ khai thuế.
   */
  reverseLookup(prefectureCode: string, address: string): ReverseLookupResult {
    const prefecture = JP_PREFECTURES.find((p) => p.value === prefectureCode);
    if (!prefecture || !(address || '').trim()) {
      throw new CBadRequestException(ErrorCode.JP_ADDRESS_INVALID);
    }
    return reverseLookup(
      this.referenceData.postalData,
      prefectureCode,
      address,
      prefecture.label,
    );
  }

  async lookup(postalCode: string): Promise<{ results: PostalAddress[] }> {
    const normalized = (postalCode || '').replace(/[^0-9]/g, '');
    if (normalized.length !== 7) {
      throw new CBadRequestException(ErrorCode.POSTAL_CODE_INVALID);
    }

    let payload: any;
    try {
      payload = await this.fetchJson(`${ZIPCLOUD_URL}${normalized}`);
    } catch (error) {
      this.logger.warn(`Tra mã bưu điện ${normalized} thất bại: ${error}`);
      throw new CBadRequestException(ErrorCode.POSTAL_CODE_LOOKUP_FAILED);
    }

    if (payload?.status !== 200 || !Array.isArray(payload?.results)) {
      return { results: [] };
    }

    const results: PostalAddress[] = payload.results.map((r: any) => {
      const code = String(parseInt(r.prefcode, 10));
      return {
        prefectureCode: code,
        prefectureName:
          JP_PREFECTURES.find((p) => p.value === code)?.label || r.address1,
        district: `${r.address2 || ''}${r.address3 || ''}`,
      };
    });

    return { results };
  }

  private fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      });

      req.setTimeout(REQUEST_TIMEOUT, () => req.destroy(new Error('timeout')));
      req.on('error', reject);
    });
  }
}
