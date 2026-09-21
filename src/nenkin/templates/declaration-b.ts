import { BankAccountType } from 'src/common/constatns/master-data';
import { digitsOnly, jpAddress, PaperTemplate, toWareki } from './types';

/** Ô tiền bên phải bảng 税金の計算 — 7 ô, dồn phải. */
const TAX_XS = [456, 471, 486, 501, 516, 531, 546];

/** Tâm vòng tròn khoanh loại tài khoản 普通 / 当座 / 貯蓄 của người đại diện. */
const ACCOUNT_TYPE_CIRCLE_CX: Record<number, number> = {
  [BankAccountType.NORMAL]: 460.8,
  [BankAccountType.CHECKING]: 480.8,
  [BankAccountType.SAVING]: 523.8,
};

/** Ô ghi họ và ô ghi tên của dòng フリガナ nằm tách nhau. */
const FURIGANA_SURNAME_XS = [320, 334, 348, 362, 376];
const FURIGANA_GIVEN_XS = [390, 404, 418, 432, 446];

const furiganaPart = (value: string | undefined, index: number) =>
  (value || '').trim().split(/\s+/)[index] || undefined;

/**
 * 申告書B 第一表 — tờ khai thuế thu nhập chính. 1 trang.
 *
 * Toàn bộ thuế phải nộp bằng 0 vì đây là hồ sơ xin hoàn lại phần đã khấu trừ,
 * nên nhiều ô là số 0 cố định.
 */
export const declarationB: PaperTemplate = {
  code: 'DeclarationB',
  draws: [
    {
      kind: 'text',
      x: 230,
      y: 817,
      size: 12,
      value: () => '退職所得の選択課税',
    },
    {
      kind: 'text',
      x: 52,
      y: 801,
      size: 10,
      value: (c) => c.procedure.taxOffice,
    },

    // Ngày nộp đơn khai thuế, ghi theo niên hiệu.
    {
      kind: 'text',
      x: 64,
      y: 790,
      size: 10,
      value: (c) => {
        const w = toWareki(c.procedure.taxRequestDate);
        return w ? String(w.year).padStart(2, '0') : undefined;
      },
    },
    {
      kind: 'text',
      x: 90,
      y: 790,
      size: 10,
      value: (c) => toWareki(c.procedure.taxRequestDate)?.month,
    },
    {
      kind: 'text',
      x: 115,
      y: 790,
      size: 10,
      value: (c) => toWareki(c.procedure.taxRequestDate)?.day,
    },
    // 年分: năm nhận kết quả Nenkin lần 1.
    {
      kind: 'text',
      x: 198,
      y: 788,
      size: 14,
      value: (c) => toWareki(c.worker.resultDate1)?.year?.toString(),
    },

    // Mã bưu điện và địa chỉ cuối cùng ở Nhật.
    {
      kind: 'chars',
      y: 769,
      size: 8,
      xs: [96, 110, 124, 146, 160, 174, 188],
      value: (c) => digitsOnly(c.worker.addressJpPostalCode),
    },
    {
      kind: 'lines',
      x: 89,
      size: 8,
      ys: [752, 743],
      perLine: 25,
      value: (c) => jpAddress(c.worker),
    },

    // Ngày sinh: ký hiệu niên hiệu rồi từng chữ số vào ô.
    {
      kind: 'text',
      x: 437,
      y: 769,
      size: 8,
      value: (c) => toWareki(c.worker.dateOfBirth)?.code,
    },
    {
      kind: 'chars',
      y: 769,
      size: 8,
      xs: [459, 473],
      value: (c) => {
        const w = toWareki(c.worker.dateOfBirth);
        return w ? String(w.year).padStart(2, '0') : undefined;
      },
    },
    {
      kind: 'chars',
      y: 769,
      size: 8,
      xs: [495, 510],
      value: (c) => toWareki(c.worker.dateOfBirth)?.month,
    },
    {
      kind: 'chars',
      y: 769,
      size: 8,
      xs: [531, 545],
      value: (c) => toWareki(c.worker.dateOfBirth)?.day,
    },

    // フリガナ tách họ và tên vào hai dãy ô riêng.
    {
      kind: 'chars',
      y: 749,
      size: 9,
      xs: FURIGANA_SURNAME_XS,
      value: (c) => furiganaPart(c.worker.nameFurigana, 0),
    },
    {
      kind: 'chars',
      y: 749,
      size: 9,
      xs: FURIGANA_GIVEN_XS,
      value: (c) => furiganaPart(c.worker.nameFurigana, 1),
    },
    { kind: 'text', x: 324, y: 724, size: 12, value: (c) => c.worker.name },

    // Người đại diện nộp thuế.
    { kind: 'text', x: 80, y: 706, size: 7, value: () => '納税管理人： ' },
    { kind: 'text', x: 125, y: 706, size: 7, value: (c) => c.agent?.name },
    {
      kind: 'text',
      x: 80,
      y: 699,
      size: 7,
      value: (c) => c.agent?.addressDetail,
    },

    // Các ô bằng 0 của bảng 税金の計算.
    ...[643, 540, 506, 490, 471].map((y) => ({
      kind: 'text' as const,
      x: 545,
      y,
      size: 12,
      value: () => '0',
    })),
    { kind: 'text', x: 284, y: 371, size: 12, value: () => '0' },
    { kind: 'text', x: 284, y: 270, size: 12, value: () => '0' },

    // 48 源泉徴収税額 / 49 申告納税額 / 52 還付される税金 — đều là số thuế đã khấu trừ.
    ...[440, 421, 371].map((y) => ({
      kind: 'chars' as const,
      y,
      size: 12,
      xs: TAX_XS,
      align: 'right' as const,
      value: (c) => digitsOnly(c.worker.taxAmount),
    })),

    // 還付される場所: tài khoản của người đại diện nhận tiền hoàn thuế.
    { kind: 'circle', cx: 413, cy: 174, rx: 13.2, ry: 6.7 },
    { kind: 'circle', cx: 543.1, cy: 173.5, rx: 13.2, ry: 6.2 },
    { kind: 'text', x: 327, y: 167, size: 9, value: (c) => c.agent?.bankName },
    {
      kind: 'text',
      x: 450,
      y: 167,
      size: 9,
      value: (c) => c.agent?.bankBranchName,
    },
    {
      kind: 'circle',
      cy: 144.2,
      rx: 4.4,
      ry: 4.3,
      cx: (c) => ACCOUNT_TYPE_CIRCLE_CX[c.agent?.bankAccountType as number],
    },
    {
      kind: 'chars',
      y: 127,
      size: 10,
      xs: [354, 369, 384, 399, 414, 429, 444],
      value: (c) => digitsOnly(c.agent?.bankAccountNumber),
    },
  ],
};
