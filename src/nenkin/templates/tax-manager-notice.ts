import {
  dateParts,
  deaccent,
  furiganaText,
  jpAddress,
  PaperTemplate,
  toShortTaxOfficeName,
  toWareki,
  vnAddress,
} from './types';

/** Tâm vòng tròn khoanh niên hiệu ở ô 生年月日 (大正/昭和/平成/令和 từ trên xuống). */
const ERA_CIRCLE_CY: Record<string, number> = {
  S: 614.4,
  H: 602.4,
  R: 590.4,
};

const part = (value: string | undefined, index: number) =>
  (value || '').split('-')[index] || undefined;

/**
 * 所得税・消費税の納税管理人の届出書 — thông báo chỉ định người đại diện nộp thuế.
 * 1 trang.
 */
export const taxManagerNotice: PaperTemplate = {
  code: 'TaxManagerNotice',
  draws: [
    // --- 納税地: lấy theo địa chỉ cuối cùng ở Nhật, tích ô 住所地 ---
    { kind: 'text', x: 278, y: 713, size: 10, value: () => '✓' },
    {
      kind: 'text',
      x: 289,
      y: 703,
      size: 9,
      value: (c) => part(c.worker.addressJpPostalCode, 0),
    },
    {
      kind: 'text',
      x: 325,
      y: 703,
      size: 9,
      value: (c) => part(c.worker.addressJpPostalCode, 1),
    },
    {
      kind: 'text',
      x: 277,
      y: 688,
      size: 8,
      value: (c) => jpAddress(c.worker),
    },

    // --- 税務署長 / ngày nộp. Mẫu in sẵn "税務署長" nên chỉ ghi phần tên. ---
    {
      kind: 'text',
      x: 81,
      y: 675,
      size: 12,
      maxWidth: 74,
      value: (c) => toShortTaxOfficeName(c.procedure.taxOffice) || undefined,
    },
    {
      kind: 'text',
      x: 75,
      y: 638,
      size: 10,
      value: (c) => dateParts(c.procedure.taxEntrustDate)?.y,
    },
    {
      kind: 'text',
      x: 121,
      y: 638,
      size: 10,
      value: (c) => dateParts(c.procedure.taxEntrustDate)?.m,
    },
    {
      kind: 'text',
      x: 159,
      y: 638,
      size: 10,
      value: (c) => dateParts(c.procedure.taxEntrustDate)?.d,
    },

    // --- Người lao động ---
    {
      kind: 'text',
      x: 277,
      y: 619,
      size: 9,
      value: (c) => furiganaText(c.worker.nameFurigana),
    },
    // Tên dài thì thu nhỏ cho khỏi lấn sang cột 生年月日.
    {
      kind: 'text',
      x: 277,
      y: 597,
      size: 10,
      maxWidth: 126,
      value: (c) => deaccent(c.worker.name),
    },
    {
      kind: 'circle',
      cx: 441.1,
      rx: 13.7,
      ry: 6.7,
      cy: (c) => ERA_CIRCLE_CY[toWareki(c.worker.dateOfBirth)?.code || ''],
    },
    {
      kind: 'text',
      x: 450,
      y: 602,
      size: 10,
      value: (c) => toWareki(c.worker.dateOfBirth)?.year?.toString(),
    },
    {
      kind: 'text',
      x: 474,
      y: 602,
      size: 10,
      value: (c) => toWareki(c.worker.dateOfBirth)?.month,
    },
    {
      kind: 'text',
      x: 495,
      y: 602,
      size: 10,
      value: (c) => toWareki(c.worker.dateOfBirth)?.day,
    },
    {
      kind: 'text',
      x: 281,
      y: 536,
      size: 10,
      value: (c) => c.worker.occupation,
    },

    // --- 1 納税管理人: người đại diện ---
    {
      kind: 'text',
      x: 155,
      y: 477,
      size: 10,
      value: (c) => c.agent?.addressPostalCode,
    },
    {
      kind: 'text',
      x: 150,
      y: 445,
      size: 10,
      value: (c) => c.agent?.addressDetail,
    },
    {
      kind: 'text',
      x: 148,
      y: 426,
      size: 10,
      value: (c) => c.agent?.nameFurigana,
    },
    {
      kind: 'text',
      x: 148,
      y: 409,
      size: 10,
      value: (c) => deaccent(c.agent?.name),
    },
    {
      kind: 'text',
      x: 431,
      y: 410,
      size: 10,
      value: (c) => c.procedure.relation,
    },
    {
      kind: 'text',
      x: 156,
      y: 387,
      size: 10,
      value: (c) => c.agent?.occupation,
    },
    {
      kind: 'text',
      x: 376,
      y: 387,
      size: 10,
      value: (c) => c.agent?.phoneNumber,
    },

    // --- 2 法の施行地外における住所: địa chỉ ở Việt Nam của người lao động,
    // in hoa không dấu, cách nhau bằng dấu phẩy (theo mẫu khách gửi). ---
    {
      kind: 'text',
      x: 144,
      y: 327,
      size: 10,
      maxWidth: 380,
      minSize: 7,
      value: (c) => vnAddress(c.worker, ', '),
    },

    // --- 3 納税管理人を定めた理由. Mẫu không có dòng kẻ cho mục này nên kẻ
    // thêm một dòng giống mục 2. ---
    {
      kind: 'line',
      x1: 141.4,
      y1: 282.2,
      x2: 526.6,
      y2: 282.2,
      thickness: 0.45,
    },
    {
      kind: 'text',
      x: 144,
      y: 285.5,
      size: 10,
      value: () => '日本に不在のため、納税管理人にお任せいたします。',
    },

    // --- 4 その他参考事項 ---
    // Năm xuất cảnh ghi đè lên chỗ chữ "平成" (mẫu đã che trắng), kết thúc
    // trước chữ 年 — để ở x=212 thì "2026" lấn sang chữ 年.
    {
      kind: 'text',
      x: 205.5,
      y: 230,
      size: 10,
      value: (c) => dateParts(c.worker.leaveJapanDate)?.y,
    },
    {
      kind: 'text',
      x: 246,
      y: 230,
      size: 10,
      value: (c) => dateParts(c.worker.leaveJapanDate)?.m,
    },
    {
      kind: 'text',
      x: 273,
      y: 230,
      size: 10,
      value: (c) => dateParts(c.worker.leaveJapanDate)?.d,
    },
    // Thu nhập phát sinh trong nước luôn là 給与所得.
    { kind: 'text', x: 224, y: 196, size: 10, value: () => '✓' },
    {
      kind: 'text',
      x: 100,
      y: 141,
      size: 10,
      value: () => ' 納税管理人が重複される場合は前仼者を解約します。',
    },
  ],
};
