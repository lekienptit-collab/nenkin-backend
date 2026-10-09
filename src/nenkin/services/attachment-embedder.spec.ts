import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { degrees, PDFDocument, rgb } from 'pdf-lib';
import * as sharp from 'sharp';
import { UploadService } from 'src/uploads/uploads.service';
import { AttachmentError, embedAttachment } from './attachment-embedder';
import { NenkinPdfService } from './nenkin-pdf.service';

/** Ảnh HEIC 64x48 thật do iPhone/macOS xuất ra (nén HEVC). */
const HEIC_64x48 = Buffer.from(
  'AAAAJGZ0eXBoZWljAAAAAG1pZjFNaVBybWlhZk1pSEJoZWljAAABhm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAHBpY3QAAAAAAAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAADnBpdG0AAAAAAAEAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAOZpcHJwAAAAxWlwY28AAAATY29scm5jbHgAAgACAAaAAAAADGNsbGkAywBAAAAAFGlzcGUAAAAAAAAAQAAAADAAAAAJaXJvdAAAAAAQcGl4aQAAAAADCAgIAAAAcWh2Y0MBA3AAAACwAAAAAAAe8AD8/fj4AAALA6AAAQAXQAEMAf//A3AAAAMAsAAAAwAAAwAecCShAAEAI0IBAQNwAAADALAAAAMAAAMAHqAUIEHBjE4h7kWVTcCAgYAgogABAAlEAcBhcshEU2QAAAAZaXBtYQAAAAAAAAABAAEGgQIDBYaEAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAAboAAABFAAAAAW1kYXQAAAAAAAAAVQAAAEEoAa+jZSq0//zhP/9DesvIU7yr7/SvTE52Q+iz/7mQ/v51Fqe3/+FoeQ7Ugv+Y8AQZf/ncsa0BUD/WHBMNwSpmzw==',
  'base64',
);

const solid = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  });

async function samplePdf(
  pages: { rotate?: number; blank?: boolean }[],
  encrypted = false,
) {
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const page = doc.addPage([300, 500]);
    if (!p.blank)
      page.drawRectangle({
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        color: rgb(1, 0, 0),
      });
    if (p.rotate) page.setRotation(degrees(p.rotate));
  }
  if (encrypted) {
    doc.context.trailerInfo.Encrypt = doc.context.obj({ Filter: 'Standard' });
  }
  return Buffer.from(await doc.save());
}

/** Nhúng file vào PDF mới và lưu luôn, vì pdf-lib để dồn lỗi tới lúc save(). */
async function embed(bytes: Buffer) {
  const doc = await PDFDocument.create();
  const parts = await embedAttachment(doc, bytes);
  parts.forEach((part) => {
    part.draw(doc.addPage(), {
      x: 0,
      y: 0,
      width: part.width,
      height: part.height,
    });
  });
  await doc.save();
  return parts.map(({ width, height }) => ({ width, height }));
}

describe('embedAttachment', () => {
  it.each([
    ['JPEG', () => solid(40, 20).jpeg().toBuffer()],
    ['PNG', () => solid(40, 20).png().toBuffer()],
    ['WEBP', () => solid(40, 20).webp().toBuffer()],
    [
      'WEBP có nền trong suốt',
      () => solid(40, 20).ensureAlpha(0.5).webp().toBuffer(),
    ],
  ])('nhúng được ảnh %s', async (_, make) => {
    expect(await embed(await make())).toEqual([{ width: 40, height: 20 }]);
  });

  it('nhúng được ảnh HEIC của iPhone', async () => {
    expect(await embed(HEIC_64x48)).toEqual([{ width: 64, height: 48 }]);
  });

  it('xoay ảnh JPEG theo thẻ EXIF như trình duyệt hiển thị', async () => {
    const rotated = await solid(40, 20)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect(await embed(rotated)).toEqual([{ width: 20, height: 40 }]);
  });

  it('thu nhỏ ảnh quá lớn khi phải chuyển đổi', async () => {
    const big = await solid(6000, 1500).webp().toBuffer();
    expect(await embed(big)).toEqual([{ width: 3000, height: 750 }]);
  });

  it('lấy mọi trang của file PDF, bỏ trang trắng', async () => {
    const pdf = await samplePdf([{}, { blank: true }, {}]);
    expect(await embed(pdf)).toEqual([
      { width: 300, height: 500 },
      { width: 300, height: 500 },
    ]);
  });

  it('giữ đúng chiều trang PDF có /Rotate', async () => {
    const pdf = await samplePdf([
      { rotate: 90 },
      { rotate: 180 },
      { rotate: -90 },
    ]);
    expect(await embed(pdf)).toEqual([
      { width: 500, height: 300 },
      { width: 300, height: 500 },
      { width: 500, height: 300 },
    ]);
  });

  it.each([
    [
      'PDF có mật khẩu',
      () => samplePdf([{}], true),
      'File PDF có đặt mật khẩu',
    ],
    [
      'PDF toàn trang trắng',
      () => samplePdf([{ blank: true }]),
      'File PDF không có trang nào có nội dung',
    ],
    [
      'file hỏng',
      async () => Buffer.from('not an image'),
      'Không đọc được nội dung file',
    ],
  ])('báo lý do khi gặp %s', async (_, make, reason) => {
    const error = await embed(await make()).catch((e) => e);
    expect(error).toBeInstanceOf(AttachmentError);
    expect(error.message).toBe(reason);
  });
});

describe('NenkinPdfService – ghép giấy tờ đính kèm', () => {
  let root: string;
  let service: NenkinPdfService;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nenkin-attach-'));
    mkdirSync(join(root, 'uploads'));
    const values = { 'storage.root': root, 'storage.publicPath': '/media' };
    const config: any = { get: (key: string) => values[key] };
    service = new NenkinPdfService(config, new UploadService(config));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const upload = (name: string, bytes: Buffer) => {
    writeFileSync(join(root, 'uploads', name), bytes);
    return `/media/uploads/${name}`;
  };

  it('vẫn sinh giấy tờ từ file đọc được và báo rõ file nào hỏng', async () => {
    const worker: any = {
      // Đuôi .jpg nhưng ruột là WEBP: kiểu ảnh tải từ Zalo/web.
      passportFirstPage: upload('a.jpg', await solid(40, 20).webp().toBuffer()),
      passportSecondPage: '/media/uploads/khong-con.png',
      passportStampPage: upload('c.pdf', await samplePdf([{}], true)),
    };

    const { bytes, unreadable } = await service['attachmentsToPdf'](worker, [
      'passportFirstPage',
      'passportSecondPage',
      'passportStampPage',
    ]);

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(unreadable).toEqual([
      {
        field: 'passportSecondPage',
        label: 'Trang hai',
        reason: 'Không tìm thấy file trên máy chủ',
      },
      {
        field: 'passportStampPage',
        label: 'Trang có dấu xuất cảnh',
        reason: 'File PDF có đặt mật khẩu',
      },
    ]);
  });

  it('xếp ảnh và trang PDF lên cùng một trang khi onePage', async () => {
    const worker: any = {
      residenceCardFrontImage: upload(
        'front.webp',
        await solid(40, 20).webp().toBuffer(),
      ),
      residenceCardBackImage: upload('back.pdf', await samplePdf([{}])),
    };

    const { bytes, unreadable } = await service['attachmentsToPdf'](
      worker,
      ['residenceCardFrontImage', 'residenceCardBackImage'],
      true,
    );

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(unreadable).toEqual([]);
  });
});
