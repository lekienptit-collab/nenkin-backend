import { Gender } from 'src/common/constatns/master-data';
import { digitsOnly, PaperTemplate, toWareki, vnAddress } from './types';

/**
 * Tâm vòng tròn khoanh niên hiệu trong cột 明治/大正/昭和/平成/令和 của ô ngày sinh.
 * Chỉ 3 niên hiệu dưới là có thật trong dữ liệu người lao động.
 */
const ERA_CIRCLE_CY: Record<string, number> = { S: 510.2, H: 496.2, R: 481.2 };

/** Tâm vòng tròn khoanh 男 / 女. */
const GENDER_CIRCLE_CX: Record<number, number> = {
  [Gender.MALE]: 452.4,
  [Gender.FEMALE]: 494.4,
};

/** Lấy phần thứ `index` của chuỗi dạng "080-1234-5678". */
const part = (value: string | undefined, index: number) =>
  (value || '').split('-')[index] || undefined;

/**
 * 委任状 — giấy uỷ quyền cho người đại diện. 1 trang.
 */
export const entrustApplication: PaperTemplate = {
  code: 'EntrustApplication',
  draws: [
    // --- 委任日: ngày uỷ quyền, ghi theo niên hiệu ---
    {
      kind: 'text',
      x: 431,
      y: 751,
      size: 12,
      value: (c) => toWareki(c.procedure.entrustDate)?.year?.toString(),
    },
    {
      kind: 'text',
      x: 474,
      y: 751,
      size: 12,
      value: (c) => toWareki(c.procedure.entrustDate)?.month,
    },
    {
      kind: 'text',
      x: 511,
      y: 751,
      size: 12,
      value: (c) => toWareki(c.procedure.entrustDate)?.day,
    },

    // --- 受任者: người được uỷ quyền ---
    {
      kind: 'text',
      x: 132,
      y: 716,
      size: 10,
      value: (c) => c.agent?.nameFurigana,
    },
    { kind: 'text', x: 132, y: 690, size: 12, value: (c) => c.agent?.name },
    {
      kind: 'text',
      x: 437,
      y: 702,
      size: 12,
      value: (c) => c.procedure.relation,
    },
    {
      kind: 'text',
      x: 146,
      y: 667,
      size: 12,
      value: (c) => part(c.agent?.addressPostalCode, 0),
    },
    {
      kind: 'text',
      x: 214,
      y: 667,
      size: 12,
      value: (c) => part(c.agent?.addressPostalCode, 1),
    },
    {
      kind: 'text',
      x: 134,
      y: 647,
      size: 12,
      value: (c) => c.agent?.addressDetail,
    },
    {
      kind: 'text',
      x: 376,
      y: 667,
      size: 12,
      value: (c) => part(c.agent?.phoneNumber, 0),
    },
    {
      kind: 'text',
      x: 424,
      y: 667,
      size: 12,
      value: (c) => part(c.agent?.phoneNumber, 1),
    },
    {
      kind: 'text',
      x: 477,
      y: 667,
      size: 12,
      value: (c) => part(c.agent?.phoneNumber, 2),
    },

    // --- 委任者: người lao động ---
    {
      kind: 'chars',
      y: 563,
      size: 12,
      xs: [132, 153, 174, 195, 234, 255, 276, 297, 318, 339],
      value: (c) => digitsOnly(c.worker.pensionNumber),
    },
    {
      kind: 'text',
      x: 134,
      y: 539,
      size: 12,
      value: (c) => c.worker.nameFurigana,
    },
    { kind: 'text', x: 134, y: 500, size: 12, value: (c) => c.worker.name },
    {
      kind: 'text',
      x: 128,
      y: 425,
      size: 7,
      value: (c) => vnAddress(c.worker),
    },

    // Địa chỉ là ở nước ngoài nên ô mã bưu điện Nhật luôn in 〒000-0000.
    { kind: 'text', x: 146, y: 439, size: 10, value: () => '000' },
    { kind: 'text', x: 214, y: 439, size: 10, value: () => '0000' },

    // Ngày sinh: khoanh niên hiệu rồi ghi năm/tháng/ngày.
    {
      kind: 'circle',
      cx: 414.7,
      rx: 12.5,
      ry: 7.6,
      cy: (c) => ERA_CIRCLE_CY[toWareki(c.worker.dateOfBirth)?.code || ''],
    },
    {
      kind: 'text',
      x: 454,
      y: 506,
      size: 12,
      value: (c) => toWareki(c.worker.dateOfBirth)?.year?.toString(),
    },
    {
      kind: 'text',
      x: 490,
      y: 506,
      size: 12,
      value: (c) => toWareki(c.worker.dateOfBirth)?.month,
    },
    {
      kind: 'text',
      x: 520,
      y: 506,
      size: 12,
      value: (c) => toWareki(c.worker.dateOfBirth)?.day,
    },

    // Khoanh giới tính.
    {
      kind: 'circle',
      cy: 460.4,
      rx: 10.3,
      ry: 10,
      cx: (c) => GENDER_CIRCLE_CX[c.worker.gender as number],
    },

    // --- 委任する内容: luôn chọn mục 3 (年金の請求) và mục 8 (その他) ---
    { kind: 'circle', cx: 135.4, cy: 300.4, rx: 10.3, ry: 10 },
    { kind: 'circle', cx: 135.4, cy: 230.4, rx: 10.3, ry: 10 },
    {
      kind: 'text',
      x: 150,
      y: 216,
      size: 8,
      value: () => '決定通知書の送付、脱退一時金払通知書の受け取りの権限、',
    },
    {
      kind: 'text',
      x: 150,
      y: 208,
      size: 8,
      value: () => '返却書類の通知書を受け取るの権限',
    },
  ],
};
