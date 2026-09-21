import { digitsOnly, jpAddress, money, PaperTemplate, toWareki } from './types';

/** Ô tiền của mục 退職 (74) — 7 ô, dồn phải. */
const AMOUNT_XS = [195, 210, 225, 240, 255, 270, 285];

/**
 * 申告書（分離課税用）— tờ khai thuế tách riêng, 第三表. 1 trang.
 *
 * Năm khai thuế lấy theo năm nhận được kết quả Nenkin lần 1.
 */
export const declarationSeparate: PaperTemplate = {
  code: 'DeclarationSeparate',
  draws: [
    {
      kind: 'text',
      x: 170,
      y: 817,
      size: 12,
      value: () => '退職所得の選択課税',
    },
    {
      kind: 'text',
      x: 133,
      y: 796,
      size: 14,
      value: (c) => toWareki(c.worker.resultDate1)?.year?.toString(),
    },

    {
      kind: 'text',
      x: 99,
      y: 741,
      size: 9,
      value: (c) =>
        c.worker.addressJpPostalCode
          ? `〒${c.worker.addressJpPostalCode}`
          : undefined,
    },
    {
      kind: 'lines',
      x: 99,
      size: 9,
      ys: [721, 711],
      perLine: 25,
      value: (c) => jpAddress(c.worker),
    },
    { kind: 'text', x: 102, y: 677, size: 12, value: (c) => c.worker.name },

    // Các ô "0" cố định của mẫu (thuế suất và số phải nộp đều bằng 0).
    { kind: 'text', x: 551, y: 509, size: 12, value: () => '0' },
    { kind: 'text', x: 553, y: 489, size: 12, value: () => '0' },
    { kind: 'text', x: 284, y: 258, size: 12, value: () => '0' },
    { kind: 'text', x: 284, y: 238, size: 12, value: () => '0' },
    { kind: 'text', x: 284, y: 222, size: 12, value: () => '0' },

    // 74 退職 — số tiền hưu trí thực lĩnh, điền từng chữ số vào ô.
    {
      kind: 'chars',
      y: 454,
      size: 12,
      xs: AMOUNT_XS,
      align: 'right',
      value: (c) => digitsOnly(c.worker.netPension),
    },

    // 退職所得に関する事項: 収入金額 và 退職所得控除額.
    {
      kind: 'text',
      x: 344,
      y: 168,
      size: 12,
      value: (c) => money(c.worker.netPension),
    },
    {
      kind: 'text',
      x: 472,
      y: 168,
      size: 12,
      value: (c) => money(c.worker.taxDeduct),
    },
  ],
};
