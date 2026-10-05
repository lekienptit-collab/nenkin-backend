/**
 * So khớp địa chỉ Nhật Bản với dữ liệu mã bưu điện của 日本郵便.
 *
 * Toàn bộ là hàm thuần (không đọc file, không gọi mạng) để kiểm thử được bằng
 * dữ liệu nhỏ. Dữ liệu thật nạp ở `reference-data.ts`.
 */

/** Mã tỉnh -> 市区町村 -> danh sách [町域, mã bưu điện 7 số]. */
export type PostalData = Record<string, Record<string, [string, string][]>>;

export interface PostalMatch {
  /** Dạng 123-4567, đúng như ô nhập trên form. */
  postalCode: string;
  /** 市区町村 theo đúng tên của 日本郵便, ví dụ "東かがわ市", "横浜市神奈川区". */
  city: string;
  /** 町域 nguyên văn; rỗng khi là mã chung của cả 市区町村. */
  town: string;
}

export interface ReverseLookupResult {
  /**
   * Khớp tới đâu: `town` = tìm thấy đúng khu phố, `city` = chỉ thấy 市区町村
   * nên dùng mã chung của nơi đó, `none` = không nhận ra địa chỉ.
   */
  matchLevel: 'town' | 'city' | 'none';
  results: PostalMatch[];
}

export interface ParsedAddress {
  city: string;
  /** Phần còn lại sau tên 市区町村, đã chuẩn hoá. */
  rest: string;
}

const KANJI_DIGITS = '〇一二三四五六七八九';

/** 3475 -> 三千四百七十五, 10 -> 十, 21 -> 二十一. */
const toKanjiNumber = (n: number): string => {
  if (n === 0) return '〇';
  let out = '';
  for (const [unit, value] of [
    ['千', 1000],
    ['百', 100],
    ['十', 10],
  ] as const) {
    const q = Math.floor(n / value);
    if (q > 0) out += (q > 1 ? KANJI_DIGITS[q] : '') + unit;
    n %= value;
  }
  return out + (n > 0 ? KANJI_DIGITS[n] : '');
};

/** 十九 -> 19, 三 -> 3; không phải số chữ Hán thì trả về NaN. */
const fromKanjiNumber = (s: string): number => {
  if (!/^[〇一二三四五六七八九十百千]+$/.test(s)) return NaN;
  let total = 0;
  let digit = 0;
  for (const ch of s) {
    const d = KANJI_DIGITS.indexOf(ch);
    if (d >= 0) {
      digit = d;
      continue;
    }
    const unit = ch === '千' ? 1000 : ch === '百' ? 100 : 10;
    total += (digit || 1) * unit;
    digit = 0;
  }
  return total + digit;
};

/**
 * Chữ Hán dị thể hay gặp trong địa danh: 日本郵便 ghi "塩竈市" còn 国税庁 và
 * nhiều thẻ ngoại kiều ghi "塩釜市". Chỉ dùng để so khớp, không đổi chữ in ra.
 */
const KANJI_VARIANTS: Record<string, string> = {
  竈: '釜',
  竃: '釜',
  﨑: '崎',
  嵜: '崎',
  髙: '高',
  邊: '辺',
  邉: '辺',
  濵: '浜',
  濱: '浜',
};
const KANJI_VARIANT_RE = new RegExp(
  `[${Object.keys(KANJI_VARIANTS).join('')}]`,
  'g',
);

/**
 * Chuẩn hoá để so sánh: chữ/số toàn角 về半角, bỏ khoảng trắng, thống nhất
 * ヶ/ケ (địa chỉ viết "旭ヶ丘" nhưng 日本郵便 ghi "旭ケ丘") và chữ dị thể.
 */
export const normalizeJa = (s?: string): string =>
  (s || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/ヶ/g, 'ケ')
    .replace(/ヵ/g, 'カ')
    .replace(KANJI_VARIANT_RE, (c) => KANJI_VARIANTS[c])
    .replace(/[‐－―−ー]/g, (c, i, str) =>
      // Dấu gạch giữa hai chữ số là "1-2-3"; giữ nguyên ー trong chữ Katakana.
      /\d/.test(str[i - 1] || '') ? '-' : c,
    );

/**
 * Khoá so khớp tên khu phố: đổi số Ả Rập sang chữ Hán, vì 日本郵便 viết
 * "南一条西" còn thẻ ngoại kiều hay viết "南1条西".
 */
const matchKey = (s: string): string =>
  normalizeJa(s).replace(/\d{1,4}/g, (d) => toKanjiNumber(Number(d)));

/** 町域 là mã chung cho cả 市区町村 ("一円", "…の次に番地がくる場合"). */
const isCityWide = (town: string) =>
  town === '' || /一円$|の次に番地がくる場合$/.test(town);

/** Mã bưu điện riêng của từng tầng toà nhà cao tầng — địa chỉ nhà ở không dùng. */
const isBuildingFloor = (town: string) =>
  /（(?:地階・階層不明|\d+階|[０-９]+階)）$/.test(town);

const formatPostal = (zip: string) => `${zip.slice(0, 3)}-${zip.slice(3)}`;

/** Bỏ tên tỉnh ở đầu nếu người dùng gõ cả vào ô quận/huyện. */
const stripPrefecture = (address: string, prefectureName?: string) => {
  const name = normalizeJa(prefectureName);
  return name && address.startsWith(name)
    ? address.slice(name.length)
    : address;
};

/**
 * Tìm 市区町村 ở đầu chuỗi địa chỉ. Địa chỉ đôi khi bỏ tên 郡 ("倶知安町…"
 * thay vì "虻田郡倶知安町…") nên thử cả hai dạng; lấy tên khớp dài nhất.
 */
export const parseJpAddress = (
  data: PostalData,
  prefectureCode: string,
  address: string,
  prefectureName?: string,
): ParsedAddress[] => {
  const cities = data[String(prefectureCode)];
  if (!cities) return [];
  const text = stripPrefecture(normalizeJa(address), prefectureName);

  let best = 0;
  let found: ParsedAddress[] = [];
  for (const city of Object.keys(cities)) {
    const full = normalizeJa(city);
    const withoutGun = full.replace(/^.+?郡/, '');
    for (const form of new Set([full, withoutGun])) {
      if (!form || !text.startsWith(form) || form.length < best) continue;
      if (form.length > best) found = [];
      best = form.length;
      found.push({ city, rest: text.slice(form.length) });
    }
  }
  return found;
};

interface RangeItem {
  from: number;
  to: number;
  kind: 'chome' | 'banchi';
}

/** "（１〜１９丁目）" / "（１・２丁目）" / "（３丁目、５丁目）" -> các khoảng số. */
const parseRanges = (paren: string): RangeItem[] => {
  const text = normalizeJa(paren);
  const ranges: RangeItem[] = [];
  for (const [, body, kind] of text.matchAll(/([\d〜~・、]+)(丁目|番地)/g)) {
    for (const part of body.split(/[・、]/)) {
      const [a, b] = part.split(/[〜~]/).map(Number);
      if (!Number.isNaN(a)) {
        ranges.push({
          from: a,
          to: Number.isNaN(b) ? a : b,
          kind: kind === '丁目' ? 'chome' : 'banchi',
        });
      }
    }
  }
  return ranges;
};

/** Số đầu tiên ngay sau tên khu phố: "西一丁目96番地" -> 1, "3475番地" -> 3475. */
const leadingNumber = (rest: string): number => {
  const digits = /^(\d+)/.exec(rest);
  if (digits) return Number(digits[1]);
  const kanji = /^([〇一二三四五六七八九十百千]+)/.exec(rest);
  return kanji ? fromKanjiNumber(kanji[1]) : NaN;
};

/**
 * Một khu phố có nhiều mã theo 丁目 / 番地 (札幌 "南一条西（１〜１９丁目）" và
 * "（２０〜２８丁目）"): lọc theo số đứng sau tên khu phố. Mục nào không ghi
 * khoảng số (vd "（その他）") dùng làm dự phòng.
 */
const filterByNumber = (
  entries: [string, string][],
  number: number,
): [string, string][] => {
  if (Number.isNaN(number)) return entries;
  const ranged: [string, string][] = [];
  const others: [string, string][] = [];
  for (const entry of entries) {
    const paren = /（(.*)）$/.exec(entry[0])?.[1];
    const ranges = paren ? parseRanges(paren) : [];
    if (ranges.length === 0) {
      others.push(entry);
    } else if (ranges.some((r) => number >= r.from && number <= r.to)) {
      ranged.push(entry);
    }
  }
  if (ranged.length) return ranged;
  return others.length ? others : entries;
};

/**
 * Tra mã bưu điện từ địa chỉ ở Nhật (tỉnh + phần còn lại của địa chỉ).
 *
 * Cách tìm: xác định 市区町村 ở đầu địa chỉ, rồi tìm 町域 dài nhất khớp với
 * phần đầu của phần còn lại. Không thấy 町域 thì dùng mã chung của 市区町村
 * ("以下に掲載がない場合"), đúng như 日本郵便 hướng dẫn.
 */
export const reverseLookup = (
  data: PostalData,
  prefectureCode: string,
  address: string,
  prefectureName?: string,
): ReverseLookupResult => {
  const parsed = parseJpAddress(data, prefectureCode, address, prefectureName);
  if (parsed.length === 0) return { matchLevel: 'none', results: [] };

  const townResults: PostalMatch[] = [];
  const cityResults: PostalMatch[] = [];

  for (const { city, rest } of parsed) {
    const entries = data[String(prefectureCode)][city];
    const restKey = matchKey(rest.replace(/^大?字/, ''));

    const candidates = entries
      .filter(([town]) => !isCityWide(town) && !isBuildingFloor(town))
      .map((entry) => ({ entry, key: matchKey(entry[0].replace(/（.*$/, '')) }))
      .filter(({ key }) => key.length > 0);

    // Ưu tiên khớp phần đầu; địa chỉ Kyoto ghi tên đường trước tên khu phố
    // ("河原町通二条上る一之船入町") nên mới phải tìm ở giữa chuỗi.
    let matched = candidates.filter(({ key }) => restKey.startsWith(key));
    if (matched.length === 0) {
      matched = candidates.filter(
        ({ key }) => key.length >= 2 && restKey.includes(key),
      );
    }

    if (matched.length > 0) {
      const longest = Math.max(...matched.map((m) => m.key.length));
      const top = matched.filter((m) => m.key.length === longest);
      // Số đứng ngay sau tên khu phố (丁目 hoặc 番地), dùng để chọn đúng mã
      // khi một khu phố chia nhiều mã.
      const { key } = top[0];
      const number = leadingNumber(
        restKey.slice(restKey.indexOf(key) + key.length),
      );
      for (const [town, zip] of filterByNumber(
        top.map((m) => m.entry),
        number,
      )) {
        townResults.push({ postalCode: formatPostal(zip), city, town });
      }
      continue;
    }

    const cityWide = entries.find(([town]) => isCityWide(town));
    if (cityWide) {
      cityResults.push({
        postalCode: formatPostal(cityWide[1]),
        city,
        town: '',
      });
    }
  }

  const level = townResults.length
    ? 'town'
    : cityResults.length
    ? 'city'
    : 'none';
  const results = townResults.length ? townResults : cityResults;
  // Cùng một mã có thể lặp lại qua nhiều 町域 (vd. "（その他）"), chỉ giữ một.
  return {
    matchLevel: level,
    results: results.filter(
      (r, i) => results.findIndex((x) => x.postalCode === r.postalCode) === i,
    ),
  };
};
