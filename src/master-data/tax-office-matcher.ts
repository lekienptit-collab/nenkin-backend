/**
 * Tìm 税務署 phụ trách một địa chỉ, dựa trên cột 管轄区域 của 国税庁.
 *
 * Hàm thuần, chỉ làm việc với dữ liệu đã nạp sẵn. Phần lớn địa chỉ thuộc trọn
 * một 市区町村 của một sở nên tra thẳng ra kết quả; chỉ khi 市区 chia cho nhiều
 * sở ("台東区のうち浅草地区", "中央区の一部") mới trả về nhiều ứng viên để
 * tầng trên nhờ AI đọc danh sách 町名 mà chọn.
 */
import { normalizeJa } from './jp-address';

/**
 * Tên ngắn của sở thuế. Hồ sơ cũ lưu cả "真岡税務署" lẫn "真岡"; mẫu PDF đã
 * in sẵn chữ "税務署長" nên chỉ được in phần tên ("長尾 税務署長").
 */
export const toShortTaxOfficeName = (name?: string) =>
  (name || '').trim().replace(/税務署(長)?$/, '');

export interface TaxOfficeMailing {
  note?: string;
  postalCode?: string;
  lines: string[];
}

/** Một sở thuế, đúng cấu trúc file assets/reference/tax-offices.json. */
export interface TaxOfficeRecord {
  /** 署番号 của 国税庁. */
  code: string;
  /** Tên ngắn, không có hậu tố "税務署": "長尾", "名古屋中村". */
  name: string;
  kana?: string;
  /** Tên tỉnh: "香川県". */
  prefecture: string;
  location: { postalCode?: string; address: string };
  /** Nơi nhận hồ sơ gửi qua bưu điện; null thì gửi thẳng tới sở. */
  mailing: TaxOfficeMailing | null;
  phone?: string;
  jurisdiction: string;
  url?: string;
  /** Danh sách 町名 khi sở chỉ quản lý một phần 市区. */
  details?: string;
  detailUrls?: string[];
}

export interface AreaRule {
  /**
   * Đơn vị hành chính đã chuẩn hoá: "東かがわ市", "大阪市北区", "虻田郡",
   * "虻田郡倶知安町", hoặc quận không kèm tên thành phố như "兵庫区".
   */
  unit: string;
  /** Sở chỉ quản lý một phần của đơn vị này. */
  partial: boolean;
  /** "福山市のうち芦田町、駅家町" -> chỉ các 町 này của đơn vị. */
  towns?: string[];
}

/** Bỏ cách đọc viết bằng hiragana: "匝瑳（そうさ）市" -> "匝瑳市". */
const stripReadings = (s: string) => s.replace(/（[ぁ-ゖー・\s]+）/g, '');

/** "馬木1～9丁目" -> "馬木", "温品町" giữ nguyên. */
const townName = (s: string) =>
  normalizeJa(s)
    .replace(/[\d〜~～・]+丁目$/, '')
    .replace(/丁目$/, '');

const isWard = (s: string) => /区$/.test(s);

/**
 * Tách cột 管轄区域 thành các đơn vị hành chính.
 *
 * Các dạng gặp trong dữ liệu của 国税庁:
 *   "さぬき市　東かがわ市"                       đơn vị trọn vẹn
 *   "小田原市、南足柄市、足柄上郡"                 tách bằng dấu phẩy
 *   "北区（大阪市）"                              quận kèm tên thành phố
 *   "熊本市（中央区、西区、南区、北区）"
 *   "さいたま市のうち中央区・桜区"                 danh sách quận
 *   "北葛飾郡のうち杉戸町"  "東京都のうち大島町"    danh sách 町村
 *   "福山市のうち芦田町、駅家町"                   danh sách khu phố
 *   "東区の一部"  "台東区のうち浅草地区"            một phần (cần 町名)
 *   "高岡郡（伊野税務署管内の地域を除く。）"        phần còn lại
 *   "中央区\n※ 南税務署管内の地域を除きます。"      ghi chú làm cả sở thành một phần
 */
export const parseJurisdiction = (text: string): AreaRule[] => {
  const lines = stripReadings(text).split('\n');
  const notes = lines.filter((l) => l.trim().startsWith('※'));
  const officePartial = notes.some((n) => /除/.test(n));

  const body = lines
    .filter((l) => !l.trim().startsWith('※'))
    .join(' ')
    // "島尻 （しまじり）郡" sau khi bỏ cách đọc thành "島尻 郡": nối lại. Chỉ
    // nối khi 郡/市… đứng một mình, không phải chữ đầu của tên tiếp theo
    // ("美濃加茂市　郡上市", "緑区　市原市").
    .replace(/[\s　]+(?=[市区町村郡](?:[\s　、（]|の|$))/g, '');

  const chunks = body
    .split(/[\s　]+/)
    .flatMap((c) => (/のうち|（/.test(c) ? [c] : c.split('、')))
    .map((c) => c.replace(/^、|、$/g, '').trim())
    .filter(Boolean);

  const rules: AreaRule[] = [];
  const add = (unit: string, partial = false, towns?: string[]) =>
    rules.push({
      unit: normalizeJa(unit),
      partial: partial || officePartial,
      towns,
    });

  for (const chunk of chunks) {
    let m: RegExpExecArray | null;

    if ((m = /^(.+?)の一部/.exec(chunk))) {
      add(m[1], true);
    } else if ((m = /^(.+?)（.*除.*）$/.exec(chunk))) {
      add(m[1], true);
    } else if ((m = /^(.+?区)（(.+?市)）$/.exec(chunk))) {
      add(m[2] + m[1]);
    } else if ((m = /^(.+?市)（(.+)）$/.exec(chunk))) {
      m[2].split(/[、・]/).forEach((ward) => add(m[1] + ward));
    } else if ((m = /^(.+?)のうち(.+)$/.exec(chunk))) {
      const [, parent, list] = m;
      if (/地区|地域|以北|以南|以東|以西/.test(list)) {
        add(parent, true);
        continue;
      }
      const items = list
        .split(/[、・]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parent === '東京都') {
        items.forEach((item) => add(item));
      } else if (
        /[市郡]$/.test(parent) &&
        items.every((i) => /[区町村]$/.test(i) && !/[\d〜～]/.test(i))
      ) {
        // "さいたま市のうち中央区" / "北葛飾郡のうち杉戸町". Riêng "福山市のうち
        // 芦田町" là khu phố của 市 chứ không phải 町村 riêng: 日本郵便 ghi
        // 市区町村 là "福山市" nên ghép "福山市芦田町" sẽ không khớp gì — xử lý
        // ở nhánh dưới bằng cách so thêm phần khu phố.
        const isTownList =
          /市$/.test(parent) && items.some((i) => /町$/.test(i));
        if (isTownList) add(parent, false, items.map(townName));
        else items.forEach((item) => add(parent + item));
      } else {
        add(parent, false, items.map(townName));
      }
    } else {
      add(chunk);
    }
  }
  return rules;
};

export type MatchKind = 'exact' | 'parent' | 'ward';

export interface OfficeMatch<T extends TaxOfficeRecord = TaxOfficeRecord> {
  office: T;
  partial: boolean;
  kind: MatchKind;
  /** Khớp nhờ danh sách khu phố ("福山市のうち芦田町") — cụ thể nhất. */
  byTown: boolean;
}

/**
 * Đơn vị trong 管轄区域 có bao trùm 市区町村 này không.
 *   exact  — trùng tên ("東かがわ市", "大阪市北区")
 *   parent — đơn vị là thành phố/郡 chứa nó ("相模原市" chứa "相模原市南区")
 *   ward   — chỉ ghi tên quận, không ghi thành phố ("南区")
 */
const matchUnit = (unit: string, city: string): MatchKind | undefined => {
  if (unit === city) return 'exact';
  // Đảo thuộc Tokyo: 国税庁 ghi "三宅村", 日本郵便 ghi "三宅島三宅村".
  if (/[町村]$/.test(unit) && city.endsWith(unit) && !city.includes('郡')) {
    return 'exact';
  }
  if (/[市郡]$/.test(unit) && city.startsWith(unit)) return 'parent';
  if (isWard(unit) && !unit.includes('市')) {
    const ward = /^.+?市(.+区)$/.exec(city)?.[1];
    if (ward === unit) return 'ward';
  }
  return undefined;
};

const KIND_ORDER: Record<MatchKind, number> = { exact: 0, parent: 1, ward: 2 };

/**
 * Các sở có thể phụ trách 市区町村 `city` (tên theo 日本郵便) với phần địa chỉ
 * còn lại `rest`. Kết quả đã lọc theo độ cụ thể:
 *   - có khớp ghi rõ tên thành phố thì bỏ các khớp chỉ theo tên quận
 *     ("相模原市" thắng "南区" của 横浜南 khi địa chỉ là 相模原市南区);
 *   - có sở quản lý trọn vẹn thì bỏ các sở chỉ quản lý "phần còn lại"
 *     ("高岡郡のうち日高村" thắng "高岡郡（…を除く。）").
 */
export const findOffices = <T extends TaxOfficeRecord>(
  offices: { office: T; rules: AreaRule[] }[],
  city: string,
  rest: string,
): OfficeMatch<T>[] => {
  const cityKey = normalizeJa(city);
  const restKey = normalizeJa(rest).replace(/^大?字/, '');

  const matches: OfficeMatch<T>[] = [];
  for (const { office, rules } of offices) {
    let best: OfficeMatch<T> | undefined;
    for (const rule of rules) {
      const kind = matchUnit(rule.unit, cityKey);
      if (!kind) continue;
      if (rule.towns && !rule.towns.some((t) => t && restKey.startsWith(t)))
        continue;
      const candidate = {
        office,
        partial: rule.partial,
        kind,
        byTown: !!rule.towns,
      };
      const better =
        !best ||
        (best.partial && !candidate.partial) ||
        (candidate.byTown && !best.byTown) ||
        KIND_ORDER[candidate.kind] < KIND_ORDER[best.kind];
      if (better) best = candidate;
    }
    if (best) matches.push(best);
  }

  let result = matches;
  if (result.some((m) => m.kind !== 'ward')) {
    result = result.filter((m) => m.kind !== 'ward');
  }
  if (result.some((m) => m.byTown)) {
    result = result.filter((m) => m.byTown);
  } else if (result.some((m) => !m.partial)) {
    result = result.filter((m) => !m.partial);
  }
  return result;
};
