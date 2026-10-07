import { JP_PREFECTURES, VN_PROVINCES } from 'src/common/constatns/master-data';
import { AgentEntity } from 'src/entities/agent.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { WorkerEntity } from 'src/entities/worker.entity';

/** Dữ liệu dùng để điền một bộ giấy tờ. */
export interface FillContext {
  worker: WorkerEntity;
  agent?: AgentEntity;
  procedure: NenkinProcedureEntity;
}

type Value = (c: FillContext) => string | undefined;

/**
 * Toạ độ có thể là số cố định, hoặc hàm khi vị trí phụ thuộc dữ liệu —
 * ví dụ vòng tròn khoanh niên hiệu nằm ở dòng khác nhau cho 昭和/平成/令和.
 * Hàm trả về undefined thì bỏ qua lệnh in đó.
 */
type Coord = number | ((c: FillContext) => number | undefined);

/**
 * Một lệnh in chữ lên mẫu PDF. Toạ độ tính theo hệ của PDF: gốc ở góc
 * dưới-trái tờ giấy, đơn vị point, y tăng khi đi lên.
 */
export type Draw =
  /**
   * In một chuỗi bắt đầu từ (x, y). Có `maxWidth` thì chuỗi dài hơn ô sẽ tự
   * thu nhỏ cỡ chữ cho vừa (không nhỏ hơn `minSize`).
   */
  | {
      kind: 'text';
      page?: number;
      x: Coord;
      y: Coord;
      size: number;
      maxWidth?: number;
      minSize?: number;
      value: Value;
    }
  /**
   * In từng ký tự vào các ô kẻ sẵn: ký tự thứ i rơi vào xs[i].
   *
   * `align: 'right'` dồn về các ô cuối — dùng cho ô tiền, vì số tiền ngắn
   * phải nằm sát mép phải của dãy ô chứ không phải mép trái.
   */
  | {
      kind: 'chars';
      page?: number;
      y: Coord;
      size: number;
      xs: number[];
      align?: 'left' | 'right';
      value: Value;
    }
  /** In chuỗi dài, tự xuống dòng sau `perLine` ký tự, mỗi dòng một y. */
  /**
   * Vòng tròn khoanh một lựa chọn in sẵn trên mẫu (niên hiệu, giới tính,
   * loại tài khoản...). Hệ thống cũ khoanh bằng cách in chữ 'o'/'0' cỡ lớn;
   * ở đây vẽ ellipse để không phụ thuộc hình dáng glyph của font.
   */
  | {
      kind: 'circle';
      page?: number;
      cx: Coord;
      cy: Coord;
      rx: Coord;
      ry: Coord;
      /** Chỉ khoanh khi hàm này trả về true. */
      when?: (c: FillContext) => boolean;
    }
  | {
      kind: 'lines';
      page?: number;
      x: Coord;
      size: number;
      ys: number[];
      perLine: number;
      value: Value;
    }
  /**
   * Dấu tích chữ V trong ô vuông có góc dưới-trái (x, y), cạnh `size`. Vẽ bằng
   * nét chứ không in ký tự "✔": font IPAex không có ký tự này nên ô bị in
   * thành hình hộp ☒.
   */
  | {
      kind: 'check';
      page?: number;
      x: number;
      y: number;
      size: number;
      when?: (c: FillContext) => boolean;
    }
  /** Đường kẻ ngang/dọc, dùng khi mẫu thiếu dòng kẻ để ghi câu trả lời. */
  | {
      kind: 'line';
      page?: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      thickness: number;
    };

/** Giải giá trị toạ độ về số. */
export const resolveCoord = (
  coord: Coord,
  c: FillContext,
): number | undefined => (typeof coord === 'function' ? coord(c) : coord);

export interface PaperTemplate {
  /** Trùng với code trong NENKIN_PAPER_TEMPLATES và tên file mẫu PDF. */
  code: string;
  draws: Draw[];
}

// ----------------------------------------------------------------- tiện ích

/** Mốc bắt đầu của từng niên hiệu Nhật còn dùng trên giấy tờ. */
const ERAS = [
  { code: 'R', name: '令和', from: '2019-05-01', base: 2018 },
  { code: 'H', name: '平成', from: '1989-01-08', base: 1988 },
  { code: 'S', name: '昭和', from: '1926-12-25', base: 1925 },
];

export interface Wareki {
  /** Ký tự viết tắt niên hiệu: R / H / S. */
  code: string;
  /** Tên niên hiệu: 令和 / 平成 / 昭和. */
  name: string;
  /** Năm theo niên hiệu. */
  year: number;
  month: string;
  day: string;
}

/** Đổi ngày ISO sang niên hiệu Nhật. Trả về undefined nếu ngày rỗng. */
export const toWareki = (iso?: string): Wareki | undefined => {
  if (!iso) return undefined;
  const date = iso.slice(0, 10);
  const era = ERAS.find((e) => date >= e.from);
  if (!era) return undefined;
  return {
    code: era.code,
    name: era.name,
    year: Number(date.slice(0, 4)) - era.base,
    month: date.slice(5, 7),
    day: date.slice(8, 10),
  };
};

/** Tách ngày ISO thành năm / tháng / ngày dương lịch. */
export const dateParts = (iso?: string) =>
  iso
    ? { y: iso.slice(0, 4), m: iso.slice(5, 7), d: iso.slice(8, 10) }
    : undefined;

/**
 * Bỏ dấu tiếng Việt: các ô chữ Latin trên mẫu Nhật chỉ nhận chữ không dấu,
 * và font dùng để in cũng không có sẵn glyph cho chữ có dấu ("Ễ", "Ộ"...).
 *
 * NFC ở cuối để ghép lại chữ Kana có dấu ゛゜ ("グ" bị NFD tách thành
 * "ク" + dấu rời) — tên ngân hàng/chi nhánh Nhật cũng đi qua hàm này.
 */
export const deaccent = (v?: string) =>
  v
    ? v
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .normalize('NFC')
    : v;

/** Chỉ giữ chữ số. */
export const digitsOnly = (v?: string) => (v || '').replace(/[^0-9]/g, '');

/**
 * Các từ trong tên Katakana. Người dùng gõ lẫn dấu cách toàn角/半角, có khi
 * hai dấu liền nhau ("ゴー　グエン 　ホアン 　ロン").
 */
export const furiganaWords = (v?: string) =>
  (v || '').split(/[\s　]+/).filter(Boolean);

/** Tên Katakana in thành một dòng, các từ cách nhau một dấu cách toàn角. */
export const furiganaText = (v?: string) =>
  furiganaWords(v).join('　') || undefined;

/**
 * Tên Katakana điền vào dãy ô: mỗi ký tự một ô, giữa các từ để trống một ô
 * (như hệ thống cũ). Tên dài hơn số ô thì bỏ ô trống giữa các từ để giữ đủ chữ.
 */
export const furiganaBoxes = (v: string | undefined, boxes: number) => {
  const words = furiganaWords(v);
  const spaced = words.join(' ');
  return [...spaced].length <= boxes ? spaced : words.join('');
};

export { toShortTaxOfficeName } from 'src/master-data/tax-office-matcher';

/** 1111111 -> "1,111,111". */
export const money = (v?: string | number) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || Number.isNaN(n)
    ? undefined
    : n.toLocaleString('en-US');
};

/** Mẫu 脱退一時金請求書 có 11 ô SWIFT; mã 8 ký tự được đệm 'X' cho đủ. */
export const padSwift = (v?: string) =>
  v ? v.toUpperCase().padEnd(11, 'X') : undefined;

/** Tên tỉnh Nhật theo mã đang lưu trong hồ sơ. */
export const jpPrefectureName = (code?: string) =>
  JP_PREFECTURES.find((p) => p.value === code)?.label;

/** Tên tỉnh Việt Nam theo mã đang lưu trong hồ sơ. */
export const vnProvinceName = (code?: string) =>
  VN_PROVINCES.find((p) => p.value === code)?.label;

/** Ghép địa chỉ ở Nhật thành một dòng: 都道府県 + 市区町村 + số nhà. */
export const jpAddress = (w: WorkerEntity) =>
  [
    jpPrefectureName(w.addressJpPrefectureCode),
    w.addressJpDistrict,
    w.addressJpHouseNumber,
  ]
    .filter(Boolean)
    .join('') || undefined;

/**
 * Ghép địa chỉ Việt Nam: số nhà, xã/phường, tỉnh, quốc gia — in hoa, không
 * dấu. 委任状 dùng dấu " - " như mẫu cũ; 納税管理人の届出書 dùng ", " theo
 * mẫu khách gửi ("SO NHA 58 TO DAN PHO NUM, PHUONG BAC GIANG, BAC NINH, VIET NAM").
 */
export const vnAddress = (w: WorkerEntity, separator = ' - ') =>
  [
    w.addressVnAddress,
    w.addressVnDistrict,
    vnProvinceName(w.addressVnPrefectureCode),
    w.country,
  ]
    .filter(Boolean)
    .map((s) => deaccent(String(s).trim()).toUpperCase())
    .filter(Boolean)
    .join(separator) || undefined;
