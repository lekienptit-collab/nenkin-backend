import { jpAddress, money, PaperTemplate, toWareki } from './types';

/**
 * 確定申告書B 第二表 — bảng kê chi tiết thu nhập và thuế đã khấu trừ. 1 trang.
 */
export const finalDeclarationB: PaperTemplate = {
  code: 'FinalDeclarationB',
  draws: [
    {
      kind: 'text',
      x: 150,
      y: 814,
      size: 12,
      value: () => '退職所得の選択課税',
    },
    {
      kind: 'text',
      x: 97,
      y: 794,
      size: 14,
      value: (c) => toWareki(c.worker.resultDate1)?.year?.toString(),
    },

    {
      kind: 'text',
      x: 95,
      y: 741,
      size: 9,
      value: (c) =>
        c.worker.addressJpPostalCode
          ? `〒 ${c.worker.addressJpPostalCode}`
          : undefined,
    },
    {
      kind: 'lines',
      x: 95,
      size: 9,
      ys: [726, 711],
      perLine: 25,
      value: (c) => jpAddress(c.worker),
    },
    { kind: 'text', x: 100, y: 670, size: 12, value: (c) => c.worker.name },

    // Người đại diện nộp thuế, ghi ngay dưới tên người khai.
    { kind: 'text', x: 45, y: 645, size: 9, value: () => '納税管理人： ' },
    { kind: 'text', x: 99, y: 645, size: 9, value: (c) => c.agent?.name },
    {
      kind: 'text',
      x: 44,
      y: 632,
      size: 9,
      value: (c) => c.agent?.addressDetail,
    },

    // 所得の内訳: khoản thu là trợ cấp một lần do 日本年金機構 chi trả.
    { kind: 'text', x: 47, y: 581, size: 9, value: () => '脱退' },
    { kind: 'text', x: 47, y: 571, size: 9, value: () => '一時金' },
    { kind: 'text', x: 125, y: 576, size: 9, value: () => '日本年金機構' },
    {
      kind: 'text',
      x: 207,
      y: 575,
      size: 11,
      value: (c) => money(c.worker.netPension),
    },
    {
      kind: 'text',
      x: 258,
      y: 575,
      size: 11,
      value: (c) => money(c.worker.taxAmount),
    },

    // 48 源泉徴収税額の合計額
    {
      kind: 'text',
      x: 256,
      y: 484,
      size: 11,
      value: (c) => money(c.worker.taxAmount),
    },
  ],
};
