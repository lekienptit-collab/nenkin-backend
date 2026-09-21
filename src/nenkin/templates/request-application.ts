import { BankCountry } from 'src/common/constatns/master-data';
import {
  dateParts,
  deaccent,
  digitsOnly,
  padSwift,
  PaperTemplate,
  vnProvinceName,
} from './types';

const isJapanBank = (country?: string) => country === BankCountry.JAPAN;

/** Ô chữ Latin trên mẫu Nhật chỉ nhận chữ in hoa không dấu. */
const latin = (v?: string) => deaccent(v)?.toUpperCase();

/**
 * 脱退一時金請求書 — đơn xin nhận trợ cấp lương hưu trọn gói. 2 trang.
 *
 * Mẫu gốc có 3 trang; trang 3 (mục 7 — lịch sử tham gia chế độ lương hưu)
 * không được điền, giống hệ thống cũ, nên phôi chỉ giữ 2 trang đầu.
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
  ],
};
