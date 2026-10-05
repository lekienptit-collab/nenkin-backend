import { Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from 'src/common/constatns/error';
import { JP_PREFECTURES } from 'src/common/constatns/master-data';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { OpenAIVisionService } from 'src/ocr/services/openai-vision.service';
import { normalizeJa, parseJpAddress } from './jp-address';
import { ReferenceDataService, TaxOfficeEntry } from './reference-data.service';
import { findOffices, toShortTaxOfficeName } from './tax-office-matcher';

/** Trang tra cứu toàn bộ sở thuế của 国税庁, hiện kèm cho người dùng tự kiểm tra. */
export const NTA_TAX_OFFICE_SEARCH_URL =
  'https://www.nta.go.jp/about/organization/access/map.htm';

/** Thông tin một sở thuế trả cho frontend (bỏ danh sách 町名 dài). */
export interface TaxOfficeView {
  code: string;
  /** Tên ngắn lưu vào hồ sơ và in trước chữ 税務署長: "長尾". */
  name: string;
  /** "長尾税務署". */
  fullName: string;
  kana?: string;
  prefecture: string;
  prefectureCode: string;
  location: { postalCode?: string; address: string };
  /** Nơi nhận hồ sơ gửi qua bưu điện; null thì gửi thẳng tới sở. */
  mailing: { note?: string; postalCode?: string; lines: string[] } | null;
  phone?: string;
  jurisdiction: string;
  url?: string;
  /** Trang/PDF liệt kê 町名 khi sở chỉ quản lý một phần 市区. */
  detailUrls?: string[];
}

export interface TaxOfficeSuggestion {
  /** Sở đề xuất; không có khi chưa chọn được. */
  office?: TaxOfficeView;
  /** Mọi sở có thể phụ trách địa chỉ này. */
  candidates: TaxOfficeView[];
  /**
   * address — tra thẳng theo 管轄区域 của 国税庁;
   * ai      — 市区 chia cho nhiều sở, AI đọc danh sách 町名 rồi chọn;
   * none    — chưa chọn được, người dùng tự chọn trong `candidates`.
   */
  method: 'address' | 'ai' | 'none';
  /** 市区町村 nhận ra từ địa chỉ. */
  city?: string;
  /** Lý do AI đưa ra. */
  reason?: string;
  searchUrl: string;
}

/** Mỗi bộ hồ sơ mở lại vẫn hỏi đúng địa chỉ đó: nhớ kết quả AI để khỏi tốn thêm lượt. */
const CACHE_LIMIT = 500;

/** Giới hạn độ dài danh sách 町名 gửi cho AI ở mỗi ứng viên. */
const DETAIL_LIMIT = 6000;

@Injectable()
export class TaxOfficeService {
  private readonly logger = new Logger(TaxOfficeService.name);
  private readonly cache = new Map<string, TaxOfficeSuggestion>();

  constructor(
    private readonly referenceData: ReferenceDataService,
    private readonly vision: OpenAIVisionService,
  ) {}

  private toView({ office }: TaxOfficeEntry): TaxOfficeView {
    return {
      code: office.code,
      name: office.name,
      fullName: `${office.name}税務署`,
      kana: office.kana,
      prefecture: office.prefecture,
      prefectureCode: office.prefectureCode,
      location: office.location,
      mailing: office.mailing,
      phone: office.phone,
      jurisdiction: office.jurisdiction,
      url: office.url,
      detailUrls: office.detailUrls,
    };
  }

  /** Toàn bộ sở thuế cho ô chọn "Văn phòng thuế". */
  list(): TaxOfficeView[] {
    return this.referenceData.taxOfficeEntries.map((e) => this.toView(e));
  }

  /** Tìm theo tên ngắn ("長尾") hoặc tên đầy đủ ("長尾税務署"). */
  findByName(name?: string): TaxOfficeView | undefined {
    const short = toShortTaxOfficeName(name);
    const entry = this.referenceData.taxOfficeEntries.find(
      (e) => e.office.name === short,
    );
    return entry ? this.toView(entry) : undefined;
  }

  /**
   * Gợi ý sở thuế phụ trách địa chỉ cuối cùng ở Nhật của người lao động —
   * đây là 納税地 trên tờ khai lần 2.
   */
  async suggest(
    prefectureCode: string,
    address: string,
  ): Promise<TaxOfficeSuggestion> {
    const prefecture = JP_PREFECTURES.find((p) => p.value === prefectureCode);
    if (!prefecture || !(address || '').trim()) {
      throw new CBadRequestException(ErrorCode.JP_ADDRESS_INVALID);
    }

    const cacheKey = `${prefectureCode}|${normalizeJa(address)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const inPrefecture = this.referenceData.taxOfficeEntries.filter(
      (e) => e.office.prefectureCode === prefectureCode,
    );
    const parsed = parseJpAddress(
      this.referenceData.postalData,
      prefectureCode,
      address,
      prefecture.label,
    );

    const matched = new Map<string, TaxOfficeEntry>();
    for (const { city, rest } of parsed) {
      for (const m of findOffices(inPrefecture, city, rest)) {
        matched.set(m.office.code, { office: m.office, rules: [] });
      }
    }
    // Không nhận ra 市区町村 thì mọi sở trong tỉnh đều là ứng viên.
    const candidates = matched.size ? [...matched.values()] : inPrefecture;
    const base = {
      candidates: candidates.map((e) => this.toView(e)),
      city: parsed[0]?.city,
      searchUrl: NTA_TAX_OFFICE_SEARCH_URL,
    };

    let result: TaxOfficeSuggestion;
    if (candidates.length === 1) {
      result = { ...base, office: base.candidates[0], method: 'address' };
    } else {
      result = await this.pickWithAi(
        `${prefecture.label}${address}`,
        candidates,
        base,
        matched.size > 0,
      );
    }

    if (this.cache.size >= CACHE_LIMIT) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * 市区 chia cho nhiều sở: đưa AI địa chỉ và danh sách 町名 của từng ứng viên
   * để chọn. AI chỉ được chọn trong danh sách; trả lời ngoài danh sách, lỗi,
   * hoặc chưa cấu hình AI thì để người dùng tự chọn.
   */
  private async pickWithAi(
    fullAddress: string,
    candidates: TaxOfficeEntry[],
    base: Omit<TaxOfficeSuggestion, 'method'>,
    withDetails: boolean,
  ): Promise<TaxOfficeSuggestion> {
    if (!this.vision.isConfigured) {
      return { ...base, method: 'none' };
    }

    const list = candidates
      .map(({ office }) => {
        const details =
          withDetails && office.details
            ? `\n町名一覧:\n${office.details.slice(0, DETAIL_LIMIT)}`
            : '';
        return `[${office.code}] ${office.name}税務署\n管轄区域: ${office.jurisdiction}${details}`;
      })
      .join('\n\n');

    const prompt = `Bạn là chuyên viên thuế Nhật Bản. Hãy xác định 税務署 phụ trách địa chỉ dưới đây.
Chỉ được chọn trong danh sách ứng viên. Đối chiếu tên 町名 và số 丁目 của địa chỉ với
管轄区域 / 町名一覧 của từng sở. Nếu thông tin không đủ để chắc chắn thì trả về null,
tuyệt đối không đoán.

Địa chỉ: ${fullAddress}

Ứng viên:
${list}

Chỉ trả về JSON:
{
  "code": "署番号 của sở đúng (lấy trong ngoặc vuông), hoặc null",
  "reason": "giải thích ngắn bằng tiếng Việt, nêu rõ 町名/丁目 nào khớp"
}`;

    try {
      const answer = await this.vision.completeJson(prompt);
      const chosen = candidates.find(
        (c) => c.office.code === String(answer.code),
      );
      if (!chosen) {
        return { ...base, method: 'none', reason: answer.reason };
      }
      return {
        ...base,
        office: this.toView(chosen),
        method: 'ai',
        reason: answer.reason,
      };
    } catch (error) {
      this.logger.warn(`AI chọn sở thuế thất bại: ${error?.message || error}`);
      return { ...base, method: 'none' };
    }
  }
}
