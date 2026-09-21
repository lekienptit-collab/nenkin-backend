import { registerAs } from '@nestjs/config';
import { join } from 'path';

export default registerAs('storage', () => ({
  /** Thư mục gốc chứa file người dùng tải lên và file PDF sinh ra. */
  root: process.env.STORAGE_ROOT || join(process.cwd(), 'storage'),
  /** Tiền tố URL để truy cập file (đã đăng ký static ở main.ts). */
  publicPath: process.env.STORAGE_PUBLIC_PATH || '/media',
  /** Dung lượng tối đa mỗi file tải lên (byte). */
  maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '10485760', 10),
}));
