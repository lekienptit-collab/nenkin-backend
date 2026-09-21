import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { ErrorCode } from 'src/common/constatns/error';
import {
  BankCountry,
  Gender,
  JP_PREFECTURES,
} from 'src/common/constatns/master-data';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { UploadService } from 'src/uploads/uploads.service';
import {
  DOCUMENT_READERS,
  FIELD_SOURCE_PRIORITY,
  MAX_DOCUMENTS_PER_REQUEST,
  WorkerDocumentType,
} from '../ocr.constants';
import { ExtractWorkerDocumentsDto } from '../dto/ocr.dto';
import { GroqRateLimitError, GroqVisionService } from './groq-vision.service';

/** Kết quả đọc của một ảnh. */
export interface DocumentResult {
  type: WorkerDocumentType;
  label: string;
  success: boolean;
  /** Các trường đã chuẩn hoá về đúng tên trường của form người lao động. */
  fields: Record<string, any>;
  errorCode?: string;
}

export interface ExtractResult {
  /** Gợi ý cuối cùng sau khi gộp mọi giấy tờ. */
  fields: Record<string, any>;
  results: DocumentResult[];
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class WorkerOcrService {
  private readonly logger = new Logger(WorkerOcrService.name);

  constructor(
    private readonly groq: GroqVisionService,
    private readonly uploadService: UploadService,
  ) {}

  get isConfigured(): boolean {
    return this.groq.isConfigured;
  }

  async extract(payload: ExtractWorkerDocumentsDto): Promise<ExtractResult> {
    if (!this.groq.isConfigured) {
      throw new CBadRequestException(ErrorCode.OCR_NOT_CONFIGURED);
    }
    const documents = (payload.documents || []).slice(
      0,
      MAX_DOCUMENTS_PER_REQUEST,
    );
    if (documents.length === 0) {
      throw new CBadRequestException(ErrorCode.OCR_NO_DOCUMENT);
    }

    // Gọi tuần tự: Groq giới hạn số token mỗi phút nên gọi song song sẽ
    // lập tức dính 429 cho phần lớn ảnh.
    const results: DocumentResult[] = [];
    for (const document of documents) {
      results.push(await this.readOne(document.type, document.url));
    }

    return { fields: this.merge(results), results };
  }

  private async readOne(
    type: WorkerDocumentType,
    url: string,
  ): Promise<DocumentResult> {
    const reader = DOCUMENT_READERS[type];
    const base: DocumentResult = {
      type,
      label: reader.label,
      success: false,
      fields: {},
    };

    const fullPath = this.uploadService.resolvePublicUrl(url);
    if (!fullPath) {
      return { ...base, errorCode: ErrorCode.OCR_IMAGE_NOT_FOUND };
    }

    const mimeType = MIME_BY_EXT[extname(fullPath).toLowerCase()];
    if (!mimeType) {
      // File PDF không gửi thẳng cho model ảnh được.
      return { ...base, errorCode: ErrorCode.OCR_IMAGE_NOT_SUPPORTED };
    }

    try {
      const raw = await this.groq.extractJson(reader.prompt, {
        buffer: readFileSync(fullPath),
        mimeType,
      });
      return { ...base, success: true, fields: this.normalize(type, raw) };
    } catch (error) {
      const errorCode =
        error instanceof GroqRateLimitError
          ? ErrorCode.OCR_RATE_LIMITED
          : error?.getResponse?.()?.msg || ErrorCode.OCR_PROVIDER_ERROR;
      this.logger.warn(`Đọc ${type} thất bại: ${errorCode}`);
      return { ...base, errorCode };
    }
  }

  /** Chuyển kết quả thô của model về đúng tên và kiểu trường của form. */
  private normalize(
    type: WorkerDocumentType,
    raw: Record<string, any>,
  ): Record<string, any> {
    const out: Record<string, any> = {};

    const text = (value: any): string | undefined => {
      if (value === null || value === undefined) return undefined;
      const s = String(value).trim();
      return s === '' || s.toLowerCase() === 'null' ? undefined : s;
    };
    const date = (value: any): string | undefined => {
      const s = text(value);
      return s && ISO_DATE.test(s) ? s : undefined;
    };
    const put = (key: string, value: any) => {
      if (value !== undefined) out[key] = value;
    };

    put('name', text(raw.name)?.toUpperCase());
    put('dateOfBirth', date(raw.dateOfBirth));
    put('country', text(raw.country));
    put('occupation', text(raw.occupation));
    put('leaveJapanDate', date(raw.leaveJapanDate));
    put('nameFurigana', text(raw.nameFurigana));
    put('addressJpDistrict', text(raw.addressJpDistrict));
    put('addressJpHouseNumber', text(raw.addressJpHouseNumber));
    put('bankName', text(raw.bankName));
    put('bankBranchName', text(raw.bankBranchName));
    put('bankBranchAddress', text(raw.bankBranchAddress));
    put('bankAccountName', text(raw.bankAccountName)?.toUpperCase());

    const gender = text(raw.gender)?.toLowerCase();
    if (gender === 'male') put('gender', Gender.MALE);
    if (gender === 'female') put('gender', Gender.FEMALE);

    // Mã số lương hưu: bỏ khoảng trắng model có thể chép lại từ ảnh.
    const pensionNumber = text(raw.pensionNumber)?.replace(/\s/g, '');
    if (pensionNumber && /^\d{4}-\d{6}$/.test(pensionNumber)) {
      put('pensionNumber', pensionNumber);
    }

    const swift = text(raw.bankSwiftCode)?.replace(/\s/g, '').toUpperCase();
    if (swift && /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift)) {
      put('bankSwiftCode', swift);
      // Ký tự thứ 5-6 của mã SWIFT là mã quốc gia ISO, đủ để chọn sẵn
      // ô "Quốc gia" của khối ngân hàng.
      const isoCountry = swift.slice(4, 6);
      if (isoCountry === 'VN') put('bankCountry', BankCountry.VIETNAM);
      if (isoCountry === 'JP') put('bankCountry', BankCountry.JAPAN);
    }

    const accountNumber = text(raw.bankAccountNumber)?.replace(/[^\d]/g, '');
    if (accountNumber) put('bankAccountNumber', accountNumber);

    // Tên tỉnh tiếng Nhật -> mã tỉnh dùng trong ô chọn.
    const prefecture = text(raw.addressJpPrefecture);
    if (prefecture) {
      const matched = JP_PREFECTURES.find((p) => p.label === prefecture);
      if (matched) put('addressJpPrefectureCode', matched.value);
    }

    this.logger.debug(
      `${type}: đọc được ${Object.keys(out).length}/${
        Object.keys(raw).length
      } trường`,
    );
    return out;
  }

  /**
   * Gộp kết quả của nhiều giấy tờ thành một bộ gợi ý.
   *
   * Với trường có khai báo trong `FIELD_SOURCE_PRIORITY` thì lấy theo đúng thứ
   * tự tin cậy đã định; các trường còn lại lấy của giấy tờ nào đọc ra trước.
   */
  private merge(results: DocumentResult[]): Record<string, any> {
    const success = results.filter((r) => r.success);
    const byType = new Map(success.map((r) => [r.type, r.fields]));
    const merged: Record<string, any> = {};

    for (const result of success) {
      for (const [field, value] of Object.entries(result.fields)) {
        if (field in merged) {
          continue;
        }
        const preferred = FIELD_SOURCE_PRIORITY[field];
        if (!preferred) {
          merged[field] = value;
          continue;
        }
        // Lấy giá trị của giấy tờ đáng tin nhất trong số đã đọc được.
        const source = preferred.find(
          (type) => byType.get(type)?.[field] !== undefined,
        );
        merged[field] = source ? byType.get(source)[field] : value;
      }
    }

    return merged;
  }
}
