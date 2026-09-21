import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { extname, join, normalize, resolve, sep } from 'path';
import { ErrorCode } from 'src/common/constatns/error';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
};

/**
 * Lưu file lên đĩa cục bộ dưới `storage.root` và trả về URL công khai.
 * Đổi sang S3/GCS thì chỉ cần thay service này.
 */
@Injectable()
export class UploadService {
  constructor(private readonly config: ConfigService) {}

  private get root(): string {
    return this.config.get<string>('storage.root');
  }

  private get publicPath(): string {
    return this.config.get<string>('storage.publicPath');
  }

  /** Thư mục con theo tháng để không dồn quá nhiều file vào 1 chỗ. */
  private currentBucket(): string {
    const now = new Date();
    return `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}`;
  }

  saveImage(file?: Express.Multer.File): { url: string; name: string } {
    if (!file || !file.buffer) {
      throw new CBadRequestException(ErrorCode.FILE_REQUIRED);
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new CBadRequestException(ErrorCode.FILE_TYPE_NOT_ALLOWED);
    }

    const maxSize = this.config.get<number>('storage.maxFileSize');
    if (file.size > maxSize) {
      throw new CBadRequestException(ErrorCode.FILE_TYPE_NOT_ALLOWED, {
        maxFileSize: maxSize,
      });
    }

    const bucket = this.currentBucket();
    const dir = join(this.root, 'uploads', bucket);
    mkdirSync(dir, { recursive: true });

    const ext = EXT_BY_MIME[file.mimetype] || extname(file.originalname) || '';
    const name = `${Date.now()}_${randomBytes(8).toString('hex')}${ext}`;
    writeFileSync(join(dir, name), file.buffer);

    return {
      url: `${this.publicPath}/uploads/${bucket}/${name}`,
      name: file.originalname,
    };
  }

  /**
   * Đổi URL công khai về đường dẫn thật trên đĩa, có chặn path traversal.
   * Trả về null nếu URL không nằm trong kho file hoặc file không tồn tại.
   */
  resolvePublicUrl(url?: string): string | null {
    if (!url || !url.startsWith(`${this.publicPath}/`)) {
      return null;
    }
    const relative = normalize(url.slice(this.publicPath.length + 1));
    if (relative.startsWith('..') || relative.startsWith(sep)) {
      return null;
    }
    const root = resolve(this.root);
    const full = resolve(root, relative);
    if (full !== root && !full.startsWith(root + sep)) {
      return null;
    }
    return existsSync(full) ? full : null;
  }

  createReadStream(fullPath: string) {
    return createReadStream(fullPath);
  }

  /**
   * Xoá file theo URL công khai. Bỏ qua khi URL rỗng hoặc file không còn.
   * Dùng khi xoá hồ sơ: ảnh giấy tờ chứa dữ liệu cá nhân nên không để lại
   * trên đĩa sau khi người dùng đã xoá.
   */
  removeByPublicUrl(url?: string): void {
    const fullPath = this.resolvePublicUrl(url);
    if (fullPath) {
      unlinkSync(fullPath);
    }
  }

  /** Xoá cả một thư mục con trong kho file, ví dụ toàn bộ PDF của 1 người lao động. */
  removeDirectory(relativePath: string): void {
    const normalized = normalize(relativePath);
    if (normalized.startsWith('..') || normalized.startsWith(sep)) {
      return;
    }
    const root = resolve(this.root);
    const full = resolve(root, normalized);
    if (full !== root && full.startsWith(root + sep) && existsSync(full)) {
      rmSync(full, { recursive: true, force: true });
    }
  }
}
