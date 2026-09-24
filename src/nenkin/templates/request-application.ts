import {
  BankCountry,
  PensionSchemeType,
} from 'src/common/constatns/master-data';
import {
  dateParts,
  deaccent,
  digitsOnly,
  Draw,
  FillContext,
  padSwift,
  PaperTemplate,
  vnProvinceName,
} from './types';

const isJapanBank = (country?: string) => country === BankCountry.JAPAN;

/** Ô chữ Latin trên mẫu Nhật chỉ nhận chữ in hoa không dấu. */
const latin = (v?: string) => deaccent(v)?.toUpperCase();

/**
 * Trang 3 — mục 7 「履歴（公的年金制度加入経過）」: bảng 4 dòng khai quá trình
 * tham gia bảo hiểm, mỗi dòng ứng với một dòng lịch sử BHXH của người lao động.
 *
 * Toạ độ đo từ đường kẻ của bảng: mép trên 4 dòng nằm ở các y dưới đây, mỗi
 * dòng cao ~59,8pt.
 */
const HISTORY_ROW_TOPS = [669.8, 609.9, 550.4, 490.4];

/** Khoảng cách từ mép trên dòng tới tâm vòng khoanh của 4 chế độ lương hưu. */
const SCHEME_CIRCLE_DY: Record<number, number> = {
  [PensionSchemeType.NATIONAL]: -6.4,
  [PensionSchemeType.EMPLOYEES]: -18.1,
  [PensionSchemeType.SEAMEN]: -30.2,
  [PensionSchemeType.MUTUAL_AID]: -41.9,
};

/** Lịch sử BHXH theo đúng thứ tự người dùng đã nhập. */
const history = (c: FillContext, index: number) =>
  [...(c.worker.insuranceHistories || [])].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
  )[index];

/** 2022-04-01 -> "2022/04/01"; cột ngày trên mẫu ghi theo dương lịch. */
const slashDate = (iso?: string) => {
  const p = dateParts(iso);
  return p ? `${p.y}/${p.m}/${p.d}` : undefined;
};

/** Bốn lệnh in cho một dòng của bảng lịch sử. */
const historyRow = (index: number): Draw[] => {
  const top = HISTORY_ROW_TOPS[index];
  const textYs = [top - 11, top - 20, top - 29, top - 38];

  return [
    // (1) 事業所の名称 — tên cơ sở kinh doanh.
    {
      kind: 'lines',
      page: 2,
      x: 50,
      size: 7,
      ys: textYs,
      perLine: 13,
      value: (c) => history(c, index)?.workPlace,
    },
    // (2) 事業所の所在地 — địa chỉ cơ sở kinh doanh.
    {
      kind: 'lines',
      page: 2,
      x: 151,
      size: 7,
      ys: textYs,
      perLine: 16,
      value: (c) => history(c, index)?.address,
    },
    // (3) 勤務期間 — từ ngày ... đến ngày.
    {
      kind: 'text',
      page: 2,
      x: 292,
      y: top - 21.5,
      size: 8,
      value: (c) => slashDate(history(c, index)?.fromDate),
    },
    {
      kind: 'text',
      page: 2,
      x: 292,
      y: top - 45,
      size: 8,
      value: (c) => slashDate(history(c, index)?.toDate),
    },
    // (4) 年金制度の種類 — khoanh số của chế độ đã tham gia.
    {
      kind: 'circle',
      page: 2,
      cx: 396,
      rx: 5,
      ry: 6,
      cy: (c) => {
        const dy = SCHEME_CIRCLE_DY[history(c, index)?.pensionScheme as number];
        return dy === undefined ? undefined : top + dy;
      },
    },
  ];
};

/**
 * 脱退一時金請求書 — đơn xin nhận trợ cấp lương hưu trọn gói. 3 trang.
 */
export const requestApplication: PaperTemplate = {
  code: 'RequestApplication',
  draws: [
    // --- Trang 1 ---
    // 1. 記入日 — ngày làm đơn, dương lịch.
    {
      kind: 'text',
      page: 0,
      x: 60,
      y: 676,
      size: 10,
      value: (c) => dateParts(c.procedure.requestDate)?.y,
    },
    {
      kind: 'text',
      page: 0,
      x: 142,
      y: 676,
      size: 10,
      value: (c) => dateParts(c.procedure.requestDate)?.m,
    },
    {
      kind: 'text',
      page: 0,
      x: 226,
      y: 676,
      size: 10,
      value: (c) => dateParts(c.procedure.requestDate)?.d,
    },

    // 3. 永住許可の有無 — luôn tích "No"; hệ thống chỉ phục vụ người đã về nước.
    { kind: 'text', page: 0, x: 42, y: 417, size: 10, value: () => '✔' },

    // 4. Họ tên, ngày sinh, quốc tịch, địa chỉ sau khi rời Nhật.
    {
      kind: 'text',
      page: 0,
      x: 142,
      y: 352,
      size: 10,
      value: (c) => latin(c.worker.name),
    },
    {
      kind: 'chars',
      page: 0,
      y: 315,
      size: 10,
      xs: [146, 168, 195, 220, 269, 292, 343, 366],
      value: (c) => digitsOnly(c.worker.dateOfBirth),
    },
    {
      kind: 'text',
      page: 0,
      x: 445,
      y: 315,
      size: 10,
      value: (c) => latin(c.worker.country),
    },
    {
      kind: 'text',
      page: 0,
      x: 144,
      y: 266,
      size: 10,
      value: (c) => latin(c.worker.addressVnAddress),
    },
    {
      kind: 'text',
      page: 0,
      x: 144,
      y: 214,
      size: 10,
      value: (c) => latin(c.worker.addressVnDistrict),
    },
    {
      kind: 'text',
      page: 0,
      x: 144,
      y: 181,
      size: 10,
      value: (c) => latin(vnProvinceName(c.worker.addressVnPrefectureCode)),
    },
    {
      kind: 'text',
      page: 0,
      x: 144,
      y: 151,
      size: 10,
      value: (c) => c.worker.addressVnPostalCode,
    },
    {
      kind: 'text',
      page: 0,
      x: 144,
      y: 120,
      size: 10,
      value: (c) => latin(c.worker.country),
    },

    // --- Trang 2: 5. tài khoản nhận tiền ---
    // Mã SWIFT chỉ cần khi nhận tiền ở ngân hàng ngoài Nhật Bản.
    {
      kind: 'chars',
      page: 1,
      y: 729,
      size: 10,
      xs: [145, 170, 195, 220, 245, 270, 295, 320, 345, 370, 395],
      value: (c) =>
        isJapanBank(c.worker.bankCountry)
          ? undefined
          : padSwift(c.worker.bankSwiftCode),
    },
    {
      kind: 'text',
      page: 1,
      x: 144,
      y: 696,
      size: 10,
      value: (c) => latin(c.worker.bankName),
    },
    {
      kind: 'text',
      page: 1,
      x: 144,
      y: 664,
      size: 10,
      value: (c) => latin(c.worker.bankBranchName),
    },
    {
      kind: 'text',
      page: 1,
      x: 144,
      y: 633,
      size: 10,
      value: (c) => latin(c.worker.bankBranchAddress),
    },
    {
      kind: 'text',
      page: 1,
      x: 185,
      y: 571,
      size: 10,
      value: (c) => latin(c.worker.bankCity),
    },
    {
      kind: 'text',
      page: 1,
      x: 185,
      y: 538,
      size: 10,
      value: (c) =>
        isJapanBank(c.worker.bankCountry) ? 'JAPAN' : latin(c.worker.country),
    },
    {
      kind: 'text',
      page: 1,
      x: 144,
      y: 508,
      size: 10,
      value: (c) => c.worker.bankAccountNumber,
    },
    {
      kind: 'text',
      page: 1,
      x: 182,
      y: 477,
      size: 10,
      value: (c) => latin(c.worker.bankAccountName),
    },
    // Tên tài khoản bằng Katakana chỉ ghi khi dùng ngân hàng trong nước Nhật.
    {
      kind: 'text',
      page: 1,
      x: 182,
      y: 440,
      size: 9,
      value: (c) =>
        isJapanBank(c.worker.bankCountry)
          ? c.worker.bankAccountNameFurigana
          : undefined,
    },

    // 6. 基礎年金番号
    {
      kind: 'chars',
      page: 1,
      y: 379,
      size: 10,
      xs: [267, 294, 321, 348, 404, 431, 458, 485, 512, 539],
      value: (c) => digitsOnly(c.worker.pensionNumber),
    },

    // --- Trang 3: 7. 履歴（公的年金制度加入経過） ---
    ...HISTORY_ROW_TOPS.flatMap((_, index) => historyRow(index)),
  ],
};
