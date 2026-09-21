import {
  BankCountry,
  NenkinServiceType,
} from 'src/common/constatns/master-data';
import { WorkerEntity } from 'src/entities/worker.entity';

/**
 * Một trường bắt buộc để làm được thủ tục Nenkin.
 * `section` khớp với id của khối trên form sửa người lao động, để frontend
 * bấm vào cảnh báo là nhảy đúng chỗ cần bổ sung.
 */
export interface RequiredField {
  field: string;
  label: string;
  section: string;
  /** Chỉ bắt buộc trong một số trường hợp (ví dụ ngân hàng ngoài Nhật). */
  when?: (w: WorkerEntity) => boolean;
}

const PERSONAL = 'personal';
const ADDRESS = 'address';
const RESIDENCE = 'residence';
const NENKIN_BOOK = 'nenkinBook';
const BANK = 'bank';
const TAX = 'tax';
const INSURANCE = 'insurance';

/** Ngân hàng nhận tiền ở ngoài Nhật thì bắt buộc có mã SWIFT. */
const isOverseasBank = (w: WorkerEntity) =>
  !!w.bankCountry && w.bankCountry !== BankCountry.JAPAN;

/** Trường bắt buộc cho thủ tục lần 1 (脱退一時金請求書 + 委任状). */
export const FIRST_REQUIRED_FIELDS: RequiredField[] = [
  { field: 'name', label: 'Họ và tên', section: PERSONAL },
  {
    field: 'nameFurigana',
    label: 'Họ và tên (Katakana)',
    section: NENKIN_BOOK,
  },
  { field: 'gender', label: 'Giới tính', section: PERSONAL },
  { field: 'dateOfBirth', label: 'Ngày tháng năm sinh', section: PERSONAL },
  { field: 'country', label: 'Quốc tịch', section: PERSONAL },
  { field: 'leaveJapanDate', label: 'Ngày rời Nhật Bản', section: PERSONAL },
  {
    field: 'passportFirstPage',
    label: 'Ảnh hộ chiếu trang đầu',
    section: PERSONAL,
  },

  {
    field: 'addressVnPrefectureCode',
    label: 'Tỉnh (địa chỉ hiện tại)',
    section: ADDRESS,
  },
  {
    field: 'addressVnDistrict',
    label: 'Thành phố/Huyện (địa chỉ hiện tại)',
    section: ADDRESS,
  },
  {
    field: 'addressVnAddress',
    label: 'Địa chỉ đầy đủ (địa chỉ hiện tại)',
    section: ADDRESS,
  },
  {
    field: 'addressJpPostalCode',
    label: 'Mã bưu điện (địa chỉ ở Nhật)',
    section: ADDRESS,
  },
  {
    field: 'addressJpPrefectureCode',
    label: 'Tỉnh/Thành phố (địa chỉ ở Nhật)',
    section: ADDRESS,
  },
  {
    field: 'addressJpDistrict',
    label: 'Xã/Phường/Thị trấn (địa chỉ ở Nhật)',
    section: ADDRESS,
  },

  {
    field: 'residenceCardFrontImage',
    label: 'Ảnh thẻ ngoại kiều mặt trước',
    section: RESIDENCE,
  },
  {
    field: 'pensionNumber',
    label: 'Mã số lương hưu cơ sở',
    section: NENKIN_BOOK,
  },

  { field: 'bankCountry', label: 'Quốc gia của ngân hàng', section: BANK },
  { field: 'bankName', label: 'Tên ngân hàng', section: BANK },
  { field: 'bankBranchName', label: 'Tên chi nhánh', section: BANK },
  { field: 'bankBranchAddress', label: 'Địa chỉ chi nhánh', section: BANK },
  { field: 'bankCity', label: 'Thành phố/Huyện của chi nhánh', section: BANK },
  { field: 'bankAccountName', label: 'Tên tài khoản', section: BANK },
  { field: 'bankAccountNumber', label: 'Số tài khoản', section: BANK },
  {
    field: 'bankSwiftCode',
    label: 'Mã Swift (BIC)',
    section: BANK,
    when: isOverseasBank,
  },
];

/**
 * Trường bắt buộc riêng cho thủ tục lần 2 (khai thuế).
 * Lần 2 cần đủ cả các trường của lần 1.
 */
export const SECOND_ONLY_REQUIRED_FIELDS: RequiredField[] = [
  { field: 'occupation', label: 'Nghề nghiệp ở Nhật Bản', section: RESIDENCE },
  { field: 'taxDeduct', label: 'Số tiền được miễn đánh thuế', section: TAX },
  { field: 'taxAmount', label: 'Số tiền thuế phải nộp', section: TAX },
  {
    field: 'netPension',
    label: 'Số tiền bảo hiểm hưu trí thực lĩnh',
    section: TAX,
  },
  { field: 'resultDate1', label: 'Ngày có kết quả Nenkin lần 1', section: TAX },
  {
    field: 'insuranceHistories',
    label: 'Quá trình tham gia chế độ lương hưu chung',
    section: INSURANCE,
  },
];

export const SECOND_REQUIRED_FIELDS: RequiredField[] = [
  ...FIRST_REQUIRED_FIELDS,
  ...SECOND_ONLY_REQUIRED_FIELDS,
];

const hasValue = (worker: WorkerEntity, field: string): boolean => {
  const value = worker[field];
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  return true;
};

export interface MissingField {
  field: string;
  label: string;
  section: string;
}

/** Trả về danh sách trường còn thiếu để làm thủ tục `serviceType`. */
export const getMissingFields = (
  worker: WorkerEntity,
  serviceType: NenkinServiceType,
): MissingField[] => {
  const required =
    serviceType === NenkinServiceType.FIRST
      ? FIRST_REQUIRED_FIELDS
      : SECOND_REQUIRED_FIELDS;

  return required
    .filter((r) => !r.when || r.when(worker))
    .filter((r) => !hasValue(worker, r.field))
    .map(({ field, label, section }) => ({ field, label, section }));
};
