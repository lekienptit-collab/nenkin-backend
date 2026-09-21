import { Transform } from 'class-transformer';

/**
 * Doi chuoi rong thanh null truoc khi validate.
 *
 * Form gui len chuoi rong khi nguoi dung xoa het noi dung mot o. Khong doi thi
 * `@Matches` se bao loi dinh dang, con doi thanh `undefined` thi `whitelist`
 * loai bo truong do va gia tri cu khong bao gio xoa duoc.
 */
export const EmptyToNull = () =>
  Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  );
