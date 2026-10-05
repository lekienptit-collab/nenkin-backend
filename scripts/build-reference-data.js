#!/usr/bin/env node
/**
 * Dựng lại dữ liệu tham chiếu trong `assets/reference/` từ nguồn chính thức:
 *
 *   - jp-postal-codes.json.gz  mã bưu điện Nhật, từ 日本郵便 (utf_ken_all.zip)
 *   - tax-offices.json         danh sách 税務署 của 国税庁: khu vực quản lý
 *                              (管轄区域) và địa chỉ gửi hồ sơ qua bưu điện
 *
 * Cả hai nguồn đều cập nhật định kỳ (mã bưu điện hằng tháng, sở thuế khi gộp
 * về "業務センター"), nên chạy lại script này vài tháng một lần rồi commit file
 * kết quả:
 *
 *   node scripts/build-reference-data.js           # cả hai
 *   node scripts/build-reference-data.js postal    # chỉ mã bưu điện
 *   node scripts/build-reference-data.js tax       # chỉ sở thuế
 *
 * Chỉ dùng thư viện có sẵn của Node (>= 18), không cần cài thêm gì.
 */
const { get } = require('https');
const { mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const { gzipSync, inflateRawSync } = require('zlib');

const OUT_DIR = join(__dirname, '..', 'assets', 'reference');

const POSTAL_ZIP_URL =
  'https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip';
const NTA_ORIGIN = 'https://www.nta.go.jp';
const NTA_INDEX = `${NTA_ORIGIN}/about/organization/access/map.htm`;

/** Hai cục thuế chỉ quản lý một tỉnh nên trang danh sách là index.htm. */
const SINGLE_PREFECTURE_BUREAUS = { sapporo: '北海道', okinawa: '沖縄県' };

// ------------------------------------------------------------------ tiện ích

const download = (url, redirects = 5) =>
  new Promise((resolve, reject) => {
    get(url, { headers: { 'User-Agent': 'nenkin-backend' } }, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirects > 0
      ) {
        res.resume();
        resolve(
          download(new URL(res.headers.location, url).href, redirects - 1),
        );
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    })
      .on('error', reject)
      .setTimeout(60000, function () {
        this.destroy(new Error(`timeout: ${url}`));
      });
  });

/** Trang của 国税庁 vẫn dùng Shift_JIS. */
const fetchSjis = async (url) =>
  new TextDecoder('shift_jis').decode(await download(url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bỏ thẻ HTML, giữ xuống dòng ở <br>, gộp khoảng trắng thừa. */
const cleanHtml = (html) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // &emsp; là dấu ngăn giữa các mục trong cột 管轄区域 ("中央区の一部&emsp;西区"),
    // bỏ đi thì hai mục dính liền nhau.
    .replace(/&(?:nbsp|ensp|emsp|thinsp);/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&[a-zA-Z]+;/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');

/**
 * Đọc file đầu tiên trong một file zip. Chỉ cần đủ cho utf_ken_all.zip
 * (một file CSV, nén deflate), khỏi phụ thuộc lệnh `unzip` của hệ điều hành.
 */
const unzipFirstEntry = (zip) => {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('File zip không hợp lệ');
  const cdOffset = zip.readUInt32LE(eocd + 16);
  if (zip.readUInt32LE(cdOffset) !== 0x02014b50) {
    throw new Error('Không đọc được central directory của file zip');
  }
  const method = zip.readUInt16LE(cdOffset + 10);
  const compressedSize = zip.readUInt32LE(cdOffset + 20);
  const localOffset = zip.readUInt32LE(cdOffset + 42);
  const nameLen = zip.readUInt16LE(localOffset + 26);
  const extraLen = zip.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLen + extraLen;
  const data = zip.subarray(start, start + compressedSize);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`Kiểu nén zip ${method} chưa hỗ trợ`);
};

/** Tách một dòng CSV có ô bọc trong dấu nháy kép. */
const parseCsvLine = (line) => {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
};

// ------------------------------------------------------------ mã bưu điện

/**
 * utf_ken_all.csv: 1 dòng 1 khu phố (町域). Cột dùng tới:
 *   [0] mã JIS của 市区町村 (2 số đầu là mã tỉnh), [2] mã bưu điện 7 số,
 *   [7] 市区町村, [8] 町域.
 *
 * Kết quả gom theo tỉnh rồi theo 市区町村:
 *   { "37": { "東かがわ市": [["", "7692700"], ["引田", "7692901"], ...] } }
 * Tên khu phố "以下に掲載がない場合" lưu thành "" (mã chung của cả 市区町村).
 */
const buildPostal = async () => {
  console.log('Tải dữ liệu mã bưu điện...');
  const csv = unzipFirstEntry(await download(POSTAL_ZIP_URL)).toString('utf8');

  const prefectures = {};
  let rows = 0;
  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const prefCode = String(parseInt(cells[0].slice(0, 2), 10));
    const zip = cells[2];
    const city = cells[7];
    const town = cells[8] === '以下に掲載がない場合' ? '' : cells[8];

    const cities = (prefectures[prefCode] = prefectures[prefCode] || {});
    (cities[city] = cities[city] || []).push([town, zip]);
    rows += 1;
  }

  const payload = {
    source: `日本郵便 郵便番号データ (${POSTAL_ZIP_URL})`,
    generatedAt: new Date().toISOString().slice(0, 10),
    prefectures,
  };
  const file = join(OUT_DIR, 'jp-postal-codes.json.gz');
  writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(payload))));
  console.log(`  ${rows} dòng -> ${file}`);
};

// ---------------------------------------------------------------- sở thuế

/**
 * "東京国税局武蔵府中業務センター" và "（厚木税務署）" có khi tách 2 dòng:
 * gộp lại để in lên phong bì cho liền.
 */
const joinParenLines = (lines) =>
  lines
    // Vùng 関東信越 để địa chỉ trong link tới file PDF in nhãn phong bì:
    // "関東信越国税局前橋業務センター（PDF／32KB）" và một dòng hướng dẫn "※…".
    .map((l) => l.replace(/（PDF[^）]*）/g, '').trim())
    .filter((l) => l && !l.startsWith('※'))
    .reduce((acc, l) => {
      if (/^（.+）$/.test(l) && acc.length) acc[acc.length - 1] += l;
      else acc.push(l);
      return acc;
    }, []);

/** "香椎（かしい）" -> { name: "香椎", kana: "かしい" }. */
const splitReading = (text) => {
  const m = /^(.+?)（(.+?)）$/.exec(text.trim());
  return m
    ? { name: m[1], kana: m[2] }
    : { name: text.trim(), kana: undefined };
};

/**
 * Ô "所在地" gồm địa chỉ sở thuế, rồi (thường là) đoạn hướng dẫn gửi hồ sơ
 * qua bưu điện tới 業務センター:
 *
 *   〒769-2302 / さぬき市長尾西871番地1 /
 *   郵送により申告書…送付願います。/ 〒760-8526 / 高松市天神前… /
 *   高松国税局高松業務センター（長尾税務署）/ 【参考】…
 */
const parseLocationCell = (cellHtml) => {
  const lines = cleanHtml(cellHtml).split('\n');
  const postal = (l) => (/^〒\s*(\d{3}-\d{4})/.exec(l) || [])[1];

  const location = {
    postalCode: postal(lines[0]),
    address: lines.slice(1).find((l) => !l.includes('郵送')) || '',
  };

  const noteIndex = lines.findIndex((l) => l.includes('郵送'));
  if (noteIndex < 0) return { location, mailing: null };

  const rest = lines.slice(noteIndex + 1);
  const end = rest.findIndex(
    (l) => l.startsWith('【参考】') || l.startsWith('「'),
  );
  const block = end < 0 ? rest : rest.slice(0, end);
  const mailingPostal = postal(block[0] || '');
  return {
    location,
    mailing: {
      note: lines[noteIndex],
      postalCode: mailingPostal,
      lines: joinParenLines(mailingPostal ? block.slice(1) : block),
    },
  };
};

/**
 * Đọc bảng theo tên cột ở hàng tiêu đề, có xử lý rowspan: vùng 関東信越 thêm
 * cột "郵送先" gộp chung cho nhiều sở, nên các hàng sau thiếu một ô.
 */
const parseTableRows = (tableHtml) => {
  const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(
    (m) => cleanHtml(m[1]),
  );
  const pending = [];
  const rows = [];
  for (const [, row] of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
    if (cells.length === 0) continue;
    const values = {};
    let next = 0;
    headers.forEach((header, col) => {
      if (pending[col] && pending[col].left > 0) {
        values[header] = pending[col].html;
        pending[col].left -= 1;
        return;
      }
      const cell = cells[next++];
      if (!cell) return;
      values[header] = cell[2];
      const span = /rowspan="(\d+)"/.exec(cell[1]);
      pending[col] = span ? { html: cell[2], left: Number(span[1]) - 1 } : null;
    });
    rows.push(values);
  }
  return rows;
};

const column = (row, pattern) =>
  Object.entries(row).find(([header]) => pattern.test(header))?.[1] || '';

const parsePrefecturePage = (html, fallbackPrefecture) => {
  const summary = /summary="税務署の所在地（(.+?)）"/.exec(html);
  const title = /<title>税務署所在地・案内（(.+?)）/.exec(html);
  const prefecture = (summary || title || [])[1] || fallbackPrefecture;

  const offices = [];
  for (const [table] of html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)) {
    if (!table.includes('署番号')) continue;
    for (const row of parseTableRows(table)) {
      const nameCell = column(row, /税務署名/);
      const code = cleanHtml(column(row, /署番号/));
      if (!nameCell || !code) continue;
      const link = /href="([^"]+)"/.exec(nameCell);
      const { name, kana } = splitReading(cleanHtml(nameCell));
      offices.push({
        code,
        name,
        kana,
        prefecture,
        ...parseLocationCell(column(row, /所在地/)),
        phone: cleanHtml(column(row, /電話/)).split('\n')[0],
        jurisdiction: cleanHtml(column(row, /管轄/)),
        url: link ? `${NTA_ORIGIN}${link[1]}` : undefined,
      });
    }
  }
  return offices;
};

/**
 * Trang phụ lục (別紙) liệt kê từng 町名 thuộc mỗi sở khi một 市区 chia cho
 * nhiều sở. Mỗi cục thuế trình bày một kiểu — có nơi mỗi sở một bảng với
 * caption "<strong>浅草税務署</strong> …", có nơi một bảng chung với dòng tiêu
 * đề "<strong>博多税務署</strong>" — nên đọc tuần tự: gặp tên sở thì mở mục
 * mới, các ô sau đó thuộc về sở đó. Tiêu đề 【福岡市東区】/ 岡山市北区 đứng
 * trước được ghi kèm để biết danh sách đó thuộc quận nào.
 */
const parseBesshiPage = (html) => {
  const byOffice = {};
  const start = html.indexOf('<table');
  const end = html.lastIndexOf('</table>');
  if (start < 0 || end < 0) return byOffice;

  let context = '';
  let current = null;
  const body = html.slice(Math.max(0, html.lastIndexOf('<h2', start)), end);
  const tokens = body.matchAll(
    /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>|<(?:th|caption)[^>]*>([\s\S]*?)<\/(?:th|caption)>|<td[^>]*>([\s\S]*?)<\/td>/g,
  );
  for (const [, heading, header, cell] of tokens) {
    if (heading !== undefined) {
      context = cleanHtml(heading).replace(/[【】]/g, '');
      continue;
    }
    if (header !== undefined) {
      const office = /<strong>(.+?)税務署<\/strong>/.exec(header);
      if (office) {
        current = office[1];
        byOffice[current] = byOffice[current] || [];
        byOffice[current].push(`【${context}】`);
      } else {
        const label = cleanHtml(header);
        if (label && !/^(よみ|管轄地域)$/.test(label)) context = label;
      }
      continue;
    }
    const text = cleanHtml(cell);
    // Cột "よみ" chỉ là chữ cái đầu (あ, か, …), bỏ đi.
    if (current && text && !/^[ぁ-ゖ]$/.test(text))
      byOffice[current].push(text);
  }
  return Object.fromEntries(
    Object.entries(byOffice).map(([office, lines]) => [
      office,
      lines.join('\n'),
    ]),
  );
};

/**
 * Mục "申告書等の郵送先" ở trang chi tiết của từng sở. Từ 2021 nhiều sở gom
 * việc nhận hồ sơ qua bưu điện về 業務センター, có nơi (Osaka) còn chia mã
 * bưu điện riêng theo khu vực, nên phải lấy đúng mục này của từng sở.
 */
const parseMailingSection = (html) => {
  const i = html.indexOf('申告書等の郵送先');
  if (i < 0) return null;
  const list = /<ul>([\s\S]*?)<\/ul>/.exec(html.slice(i));
  if (!list) return null;
  const lines = cleanHtml(list[1]).split('\n');
  const postalIndex = lines.findIndex((l) => /^〒\s*\d{3}-\d{4}/.test(l));
  if (postalIndex < 0) return null;

  const tail = lines.slice(postalIndex + 1);
  const stop = tail.findIndex(
    (l) => l.startsWith('【参考】') || l.startsWith('「'),
  );
  const block = stop < 0 ? tail : tail.slice(0, stop);
  // Sau tên 業務センター, vài nơi (沖縄) còn ghi chú "（注１）…", "詳細は…":
  // đó là lưu ý, không phải dòng địa chỉ trên phong bì.
  const noteStart = block.findIndex((l) =>
    /^(（注|詳細は|なお|また、)/.test(l),
  );
  const address = noteStart < 0 ? block : block.slice(0, noteStart);
  const extraNotes = noteStart < 0 ? [] : block.slice(noteStart);
  return {
    note: [
      ...lines
        .slice(0, postalIndex)
        .filter((l) => l.startsWith('※') || /郵便番号/.test(l)),
      ...extraNotes.filter((l) => l.startsWith('（注')),
    ].join('\n'),
    postalCode: /\d{3}-\d{4}/.exec(lines[postalIndex])[0],
    lines: joinParenLines(address),
  };
};

const buildTaxOffices = async () => {
  console.log('Tải danh sách sở thuế của 国税庁...');
  const index = await fetchSjis(NTA_INDEX);
  const links = [
    ...new Set(
      [
        ...index.matchAll(
          /href="(\/about\/organization\/([a-z]+)\/location\/([a-z_]+)\.htm)"/g,
        ),
      ].map((m) => m[1]),
    ),
  ].filter((link) => {
    const [, bureau, page] =
      /organization\/([a-z]+)\/location\/([a-z_]+)\.htm/.exec(link);
    return page !== 'index' || bureau in SINGLE_PREFECTURE_BUREAUS;
  });

  const offices = [];
  for (const link of links) {
    const bureau = /organization\/([a-z]+)\//.exec(link)[1];
    const html = await fetchSjis(`${NTA_ORIGIN}${link}`);
    const parsed = parsePrefecturePage(html, SINGLE_PREFECTURE_BUREAUS[bureau]);
    console.log(`  ${parsed[0]?.prefecture || link}: ${parsed.length} sở`);
    offices.push(...parsed);
    await sleep(200);
  }

  // Trang chi tiết của từng sở: địa chỉ gửi hồ sơ, và với sở chỉ quản lý một
  // phần 市区 thì có link sang trang phụ lục liệt kê từng 町名.
  const besshiTowns = {};
  const besshiUrls = new Set();
  for (const [i, office] of offices.entries()) {
    if (!office.url) continue;
    if (i % 50 === 0) console.log(`  trang chi tiết ${i}/${offices.length}...`);
    const detail = await fetchSjis(office.url);
    await sleep(150);

    office.mailing = parseMailingSection(detail) || office.mailing;

    const area = /管轄区域<br>([\s\S]*?)<\/li>/.exec(detail);
    const refs = area
      ? [...area[1].matchAll(/href="([^"#]+)/g)].map((m) => m[1])
      : [];
    const urls = [...new Set(refs.map((ref) => new URL(ref, office.url).href))];
    if (urls.length) office.detailUrls = urls;
    urls.filter((u) => !u.endsWith('.pdf')).forEach((u) => besshiUrls.add(u));
  }

  // Một trang phụ lục có thể liệt kê cả những sở không tự link tới nó (麹町
  // link tới trang có cả 神田・日本橋・京橋), nên gom theo tên sở trên toàn bộ.
  for (const url of besshiUrls) {
    for (const [name, text] of Object.entries(
      parseBesshiPage(await fetchSjis(url)),
    )) {
      besshiTowns[name] = [...(besshiTowns[name] || []), text];
    }
    await sleep(150);
  }
  for (const office of offices) {
    if (besshiTowns[office.name])
      office.details = besshiTowns[office.name].join('\n\n');
  }

  const payload = {
    source: `国税庁「税務署の所在地などを知りたい方」${NTA_INDEX}`,
    generatedAt: new Date().toISOString().slice(0, 10),
    offices,
  };
  const file = join(OUT_DIR, 'tax-offices.json');
  writeFileSync(file, `${JSON.stringify(payload, null, 1)}\n`);
  console.log(`  ${offices.length} sở thuế -> ${file}`);
};

// ---------------------------------------------------------------------- main

(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const target = process.argv[2] || 'all';
  if (target === 'all' || target === 'postal') await buildPostal();
  if (target === 'all' || target === 'tax') await buildTaxOffices();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
