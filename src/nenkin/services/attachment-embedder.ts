import decodeHeic = require('heic-decode');
import {
  degrees,
  PDFDocument,
  PDFEmbeddedPage,
  PDFImage,
  PDFPage,
} from 'pdf-lib';
import * as sharp from 'sharp';

/** Khung vẽ trên trang đích, toạ độ PDF tính từ góc dưới bên trái. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Một trang giấy tờ đính kèm đã nhúng vào file PDF đích, chờ xếp lên A4:
 * một ảnh, hoặc một trang của file PDF người dùng tải lên.
 */
export interface AttachmentPart {
  /** Kích thước khi hiển thị, đã tính cả góc xoay của trang. */
  width: number;
  height: number;
  draw(page: PDFPage, box: Box): void;
}

/** Không đưa được file vào bộ hồ sơ; `message` là lý do báo cho người dùng. */
export class AttachmentError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
  }
}

/** Cạnh dài nhất của ảnh sau khi chuyển đổi: in A4 vẫn nét mà PDF không quá nặng. */
const MAX_IMAGE_SIDE = 3000;

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
/** Các brand HEIF mà heic-decode nhận. */
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];

const startsWith = (bytes: Buffer, signature: Buffer) =>
  bytes.subarray(0, signature.length).equals(signature);

/** Chuẩn PDF cho phép phần đầu `%PDF-` nằm ở bất kỳ đâu trong 1024 byte đầu. */
const isPdf = (bytes: Buffer) => bytes.subarray(0, 1024).includes('%PDF-');

const isHeif = (bytes: Buffer) =>
  bytes.toString('latin1', 4, 8) === 'ftyp' &&
  HEIF_BRANDS.includes(bytes.toString('latin1', 8, 12));

/**
 * Nhúng một file giấy tờ (ảnh hoặc PDF) vào `doc`, trả về các trang để xếp.
 *
 * Định dạng nhận theo nội dung file chứ không theo đuôi: ảnh tải từ Zalo/web
 * hay có đuôi .jpg mà ruột là WEBP. pdf-lib chỉ đọc được JPEG và PNG nên các
 * định dạng khác (WEBP, HEIC...) được đổi sang JPEG trước khi nhúng.
 */
export async function embedAttachment(
  doc: PDFDocument,
  bytes: Buffer,
): Promise<AttachmentPart[]> {
  if (isPdf(bytes)) {
    return embedPdfPages(doc, bytes);
  }
  return [imagePart(await embedImage(doc, bytes))];
}

async function embedImage(doc: PDFDocument, bytes: Buffer): Promise<PDFImage> {
  const isJpeg = startsWith(bytes, JPEG_SIGNATURE);
  const isPng = startsWith(bytes, PNG_SIGNATURE);
  if ((isJpeg || isPng) && !(await needsConverting(bytes))) {
    try {
      return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch {
      // Biến thể pdf-lib không đọc được thì để sharp đổi lại bên dưới.
    }
  }
  return doc.embedJpg(await toJpeg(bytes));
}

/**
 * JPEG/PNG vẫn phải đổi lại khi ảnh có thẻ xoay EXIF: pdf-lib nhúng nguyên
 * điểm ảnh nên ảnh chụp điện thoại sẽ nằm ngang trong PDF dù trên web vẫn
 * đứng.
 */
async function needsConverting(bytes: Buffer): Promise<boolean> {
  try {
    const { orientation = 1 } = await sharp(bytes).metadata();
    return orientation > 1;
  } catch {
    return false;
  }
}

async function toJpeg(bytes: Buffer): Promise<Buffer> {
  try {
    return await (
      await decodeImage(bytes)
    )
      .rotate()
      .resize({
        width: MAX_IMAGE_SIDE,
        height: MAX_IMAGE_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (error) {
    throw new AttachmentError('Không đọc được nội dung file', error);
  }
}

async function decodeImage(bytes: Buffer): Promise<sharp.Sharp> {
  if (isHeif(bytes)) {
    // Ảnh HEIC của iPhone nén bằng HEVC, bản sharp dựng sẵn không giải mã được.
    const { width, height, data } = await decodeHeic({ buffer: bytes });
    return sharp(data, { raw: { width, height, channels: 4 } });
  }
  // Ảnh lỗi nhẹ (thiếu vài byte cuối) vẫn lấy được phần còn lại.
  return sharp(bytes, { failOn: 'none' });
}

async function embedPdfPages(
  doc: PDFDocument,
  bytes: Buffer,
): Promise<AttachmentPart[]> {
  let source: PDFDocument;
  try {
    // Mở cả file có mật khẩu chỉ để nhận ra nó: lỗi của pdf-lib biên dịch
    // kiểu ES5 nên không phân biệt được bằng instanceof.
    source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch (error) {
    throw new AttachmentError('Không đọc được nội dung file', error);
  }
  if (source.isEncrypted) {
    // pdf-lib không giải mã được nội dung, nhúng vào chỉ ra trang trắng/rác.
    throw new AttachmentError('File PDF có đặt mật khẩu');
  }

  // pdf-lib chỉ thật sự nhúng trang lúc save(), trang hỏng (vd. trang trắng
  // không có nội dung) sẽ làm hỏng cả file. Nhúng thử vào file nháp trước để
  // loại những trang đó ra.
  const probe = await PDFDocument.create();
  const parts: AttachmentPart[] = [];
  for (const page of source.getPages()) {
    const { x, y, width, height } = page.getCropBox();
    // Cắt theo CropBox (vùng người xem thấy), mặc định pdf-lib lấy cả MediaBox.
    const box = { left: x, bottom: y, right: x + width, top: y + height };
    try {
      await (await probe.embedPage(page, box)).embed();
    } catch {
      continue;
    }
    parts.push(
      pagePart(await doc.embedPage(page, box), page.getRotation().angle),
    );
  }

  if (parts.length === 0) {
    throw new AttachmentError('File PDF không có trang nào có nội dung');
  }
  return parts;
}

const imagePart = (image: PDFImage): AttachmentPart => ({
  width: image.width,
  height: image.height,
  draw: (page, box) => page.drawImage(image, box),
});

/**
 * Trang PDF có `/Rotate` thì trình xem tự xoay theo chiều kim đồng hồ khi
 * hiển thị, còn trang nhúng vào thì không: phải tự xoay lại khi vẽ.
 */
function pagePart(embedded: PDFEmbeddedPage, angle: number): AttachmentPart {
  const rotation = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  const quarter = rotation === 90 || rotation === 270;
  return {
    width: quarter ? embedded.height : embedded.width,
    height: quarter ? embedded.width : embedded.height,
    draw: (page, { x, y, width, height }) => {
      // drawPage xoay ngược chiều kim đồng hồ quanh điểm đặt, nên dời điểm
      // đặt sang góc tương ứng để trang sau khi xoay nằm gọn trong khung.
      const origin = {
        0: { x, y },
        90: { x, y: y + height },
        180: { x: x + width, y: y + height },
        270: { x: x + width, y },
      }[rotation];
      page.drawPage(embedded, {
        ...origin,
        width: quarter ? height : width,
        height: quarter ? width : height,
        rotate: degrees(-rotation),
      });
    },
  };
}
