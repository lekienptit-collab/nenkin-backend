import { BankAccountType } from 'src/common/constatns/master-data';
import {
  deaccent,
  digitsOnly,
  Draw,
  FillContext,
  furiganaBoxes,
  furiganaWords,
  jpAddress,
  PaperTemplate,
  toShortTaxOfficeName,
  toWareki,
} from './types';

/** Ô tiền bên phải bảng 税金の計算 — 7 ô, dồn phải. */
const TAX_XS = [456, 471, 486, 501, 516, 531, 546];

/**
 * Dòng ㊾ 申告納税額 âm (được hoàn thuế) nên có dấu trừ trước số tiền. Dấu
 * trừ nằm ở ô ngay trước chữ số đầu; số tiền đủ 7 chữ số thì dấu trừ lùi
 * sang ô rộng bên trái.
 */
const TAX_WITH_SIGN_XS = [440, ...TAX_XS];

/** Tâm vòng tròn khoanh loại tài khoản 普通 / 当座 / 貯蓄 (vòng chấm in sẵn). */
const ACCOUNT_TYPE_CIRCLE_CX: Record<number, number> = {
  [BankAccountType.NORMAL]: 461,
  [BankAccountType.CHECKING]: 480.6,
  [BankAccountType.SAVING]: 524.5,
};

/**
 * Ô 還付される税金の受取場所: khoanh đúng chữ in sẵn của loại tổ chức
 * (銀行 / 金庫・組合 / 農協・漁協) và loại chi nhánh (本店・支店 / 出張所 /
 * 本所・支所). Toạ độ đo theo chữ trên mẫu; vòng ôm sát chữ, không lấn dòng bên.
 */
const BANK_KIND_CIRCLES = {
  bank: { cx: 419.6, cy: 175.8, rx: 7.6, ry: 3.6 },
  kinko: { cx: 425.7, cy: 169.3, rx: 13.2, ry: 3.5 },
  nokyo: { cx: 425.7, cy: 162.8, rx: 13.2, ry: 3.5 },
};
const BRANCH_KIND_CIRCLES = {
  honten: { cx: 531.8, cy: 175.1, rx: 7.2, ry: 3.5 },
  shiten: { cx: 547.8, cy: 175.1, rx: 7.2, ry: 3.5 },
  shutchojo: { cx: 535, cy: 168.8, rx: 10.5, ry: 3.5 },
  honsho: { cx: 532, cy: 162.3, rx: 7.2, ry: 3.5 },
  shisho: { cx: 548, cy: 162.3, rx: 7.2, ry: 3.5 },
};

/**
 * Tài khoản nhận tiền hoàn thuế: bình thường là của người đại diện nộp thuế.
 * Người lao động quay lại Nhật thì tự khai thuế, không có người đại diện, nên
 * tiền hoàn về thẳng tài khoản của chính họ.
 */
const refundBank = (c: FillContext) =>
  c.agent
    ? {
        name: c.agent.bankName,
        branch: c.agent.bankBranchName,
        accountType: c.agent.bankAccountType,
        accountNumber: c.agent.bankAccountNumber,
      }
    : {
        name: c.worker.bankName,
        branch: c.worker.bankBranchName,
        accountType: c.worker.bankAccountType,
        accountNumber: c.worker.bankAccountNumber,
      };

/** Loại tổ chức tài chính đoán từ tên: "城南信用金庫" -> 金庫・組合. */
const bankKind = (name?: string): keyof typeof BANK_KIND_CIRCLES => {
  const n = (name || '').normalize('NFKC');
  if (/農業協同組合|農協|漁業協同組合|漁協|^JA/i.test(n)) return 'nokyo';
  if (/金庫|組合/.test(n)) return 'kinko';
  return 'bank';
};

/** Loại chi nhánh đoán từ tên chi nhánh; mặc định là 支店. */
const branchKind = (branch?: string): keyof typeof BRANCH_KIND_CIRCLES => {
  const n = (branch || '').trim();
  if (/本店(営業部)?$/.test(n)) return 'honten';
  if (/出張所$/.test(n)) return 'shutchojo';
  if (/本所$/.test(n)) return 'honsho';
  if (/支所$/.test(n)) return 'shisho';
  return 'shiten';
};

/**
 * Tên in vào ô: bỏ hậu tố đã có sẵn chữ in trên mẫu và đã được khoanh
 * ("三井住友銀行" -> "三井住友", "新小岩支店" -> "新小岩").
 */
const bankNameText = (name?: string) =>
  bankKind(name) === 'bank' ? (name || '').replace(/\s*銀行$/, '') : name;
const branchText = (branch?: string) =>
  (branch || '').replace(/\s*(本店|支店|出張所|本所|支所)$/, '') || branch;

const hasRefundBank = (c: FillContext) => !!refundBank(c).name;
const bankCircle = (c: FillContext) =>
  BANK_KIND_CIRCLES[bankKind(refundBank(c).name)];
const branchCircle = (c: FillContext) =>
  BRANCH_KIND_CIRCLES[branchKind(refundBank(c).branch)];

/** Ô ㊾ ghi số âm: "ー110913". */
const signedTax = (c: FillContext) => {
  const digits = digitsOnly(c.worker.taxAmount);
  if (!digits) return undefined;
  return Number(digits) === 0 ? digits : `ー${digits}`;
};

/** Dãy 14 ô フリガナ ở đầu tờ. */
const FURIGANA_XS = Array.from(
  { length: 14 },
  (_, i) => Math.round((319.2 + i * 14.48) * 10) / 10,
);

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
    // Tên sở thuế: mẫu đã in sẵn "税務署長" nên chỉ ghi phần tên.
    {
      kind: 'text',
      x: 52,
      y: 801,
      size: 10,
      maxWidth: 70,
      value: (c) => toShortTaxOfficeName(c.procedure.taxOffice) || undefined,
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

    // フリガナ: 14 ô liền nhau, mỗi ký tự một ô, giữa các từ để trống một ô.
    {
      kind: 'chars',
      y: 746.5,
      size: 9,
      xs: FURIGANA_XS,
      value: (c) => furiganaBoxes(c.worker.nameFurigana, FURIGANA_XS.length),
    },
    {
      kind: 'text',
      x: 324,
      y: 724,
      size: 12,
      value: (c) => deaccent(c.worker.name),
    },

    // 世帯主の氏名 / 世帯主との続柄: người khai tự là chủ hộ.
    {
      kind: 'text',
      x: 435,
      y: 694.5,
      size: 8,
      maxWidth: 70,
      minSize: 5,
      // Ô hẹp: cách từ bằng dấu cách nửa khổ để chữ không bị thu quá nhỏ.
      value: (c) => furiganaWords(c.worker.nameFurigana).join(' ') || undefined,
    },
    { kind: 'text', x: 511, y: 694.5, size: 8, value: () => '本人' },

    // 種類: khoanh 分離 (thu nhập 退職所得 khai tách riêng ở 第三表).
    { kind: 'circle', cx: 184.5, cy: 686.5, rx: 9.3, ry: 6.3 },

    // Người đại diện nộp thuế. Người quay lại Nhật tự khai thuế nên không có
    // người đại diện — bỏ luôn cả dòng nhãn, tránh in nhãn rồi để trống.
    {
      kind: 'text',
      x: 80,
      y: 706,
      size: 7,
      value: (c) => (c.agent ? '納税管理人： ' : undefined),
    },
    {
      kind: 'text',
      x: 125,
      y: 706,
      size: 7,
      value: (c) => deaccent(c.agent?.name),
    },
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

    // ㊽ 源泉徴収税額 / ㊿² 還付される税金 — số thuế đã khấu trừ.
    ...[440, 371].map(
      (y): Draw => ({
        kind: 'chars',
        y,
        size: 12,
        xs: TAX_XS,
        align: 'right',
        value: (c) => digitsOnly(c.worker.taxAmount),
      }),
    ),
    // ㊾ 申告納税額 — số âm vì được hoàn lại toàn bộ.
    {
      kind: 'chars',
      y: 421,
      size: 12,
      xs: TAX_WITH_SIGN_XS,
      align: 'right',
      value: signedTax,
    },
    // ㊼ 雑所得・一時所得等の源泉徴収税額の合計額.
    {
      kind: 'chars',
      y: 286,
      size: 12,
      xs: TAX_XS,
      align: 'right',
      value: (c) => digitsOnly(c.worker.taxAmount),
    },

    // 還付される場所: nơi nhận tiền hoàn thuế. Chưa có tên ngân hàng thì để
    // trống cả ô, không khoanh gì.
    {
      kind: 'circle',
      cx: (c) => bankCircle(c).cx,
      cy: (c) => bankCircle(c).cy,
      rx: (c) => bankCircle(c).rx,
      ry: (c) => bankCircle(c).ry,
      when: hasRefundBank,
    },
    {
      kind: 'circle',
      cx: (c) => branchCircle(c).cx,
      cy: (c) => branchCircle(c).cy,
      rx: (c) => branchCircle(c).rx,
      ry: (c) => branchCircle(c).ry,
      when: hasRefundBank,
    },
    {
      kind: 'text',
      x: 327,
      y: 167,
      size: 9,
      maxWidth: 80,
      value: (c) => bankNameText(refundBank(c).name),
    },
    {
      kind: 'text',
      x: 450,
      y: 167,
      size: 9,
      maxWidth: 70,
      value: (c) => branchText(refundBank(c).branch),
    },
    {
      kind: 'circle',
      cy: 143.3,
      rx: 5.2,
      ry: 5.2,
      cx: (c) => ACCOUNT_TYPE_CIRCLE_CX[refundBank(c).accountType as number],
    },
    {
      kind: 'chars',
      y: 127,
      size: 10,
      xs: [354, 369, 384, 399, 414, 429, 444],
      value: (c) => digitsOnly(refundBank(c).accountNumber),
    },
  ],
};
