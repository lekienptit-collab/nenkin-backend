export const makeRandomString = (len: number, chars: string): string => {
  let mask = '';
  if (chars.indexOf('a') > -1) mask += 'abcdefghijklmnopqrstuvwxyz';
  if (chars.indexOf('A') > -1) mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (chars.indexOf('#') > -1) mask += '0123456789';
  if (chars.indexOf('!') > -1) mask += '~!@#$%^&*()_+-={}[]:;<>?,./|';
  let result = '';
  for (let i = len; i > 0; --i) {
    result += mask[Math.floor(Math.random() * mask.length)];
  }
  return result;
};

export const genSlug = (title: string): string => {
  let slug = title.toLowerCase();
  slug = slug.replace(/á|à|ả|ạ|ã|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/gi, 'a');
  slug = slug.replace(/é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ/gi, 'e');
  slug = slug.replace(/í|ì|ỉ|ĩ|ị/gi, 'i');
  slug = slug.replace(/ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/gi, 'o');
  slug = slug.replace(/ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự/gi, 'u');
  slug = slug.replace(/ý|ỳ|ỷ|ỹ|ỵ/gi, 'y');
  slug = slug.replace(/đ/gi, 'd');
  slug = slug.replace(/[^a-z0-9\s-]/gi, '');
  slug = slug.trim().replace(/\s+/gi, '-');
  slug = slug.replace(/-+/gi, '-');
  return slug;
};

export const parseJson = <T>(t: string | null | undefined): T | undefined => {
  if (!t) return undefined;
  try {
    return JSON.parse(t) as T;
  } catch (e) {
    return undefined;
  }
};
