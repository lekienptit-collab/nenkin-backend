/**
 * Khai báo các loại giấy tờ có thể đọc bằng AI và cách đọc từng loại.
 *
 * Thêm loại giấy tờ mới: bổ sung vào `WorkerDocumentType` rồi thêm một mục
 * trong `DOCUMENT_READERS`. Không phải sửa service hay controller.
 */

/** Ô ảnh trên form người lao động, khớp với tên trường lưu URL ảnh. */
export enum WorkerDocumentType {
  PASSPORT_FIRST = 'PASSPORT_FIRST',
  PASSPORT_STAMP = 'PASSPORT_STAMP',
  RESIDENCE_CARD_FRONT = 'RESIDENCE_CARD_FRONT',
  RESIDENCE_CARD_BACK = 'RESIDENCE_CARD_BACK',
  NENKIN_BOOK = 'NENKIN_BOOK',
  BANK = 'BANK',
}

export interface DocumentReader {
  /** Nhãn hiển thị cho người dùng. */
  label: string;
  /** Yêu cầu gửi kèm ảnh cho model. */
  prompt: string;
}

/** Ràng buộc chung cho mọi yêu cầu đọc giấy tờ. */
const COMMON_RULES = `Chỉ trả về JSON đúng schema được mô tả, không thêm trường nào khác.
Trường nào không đọc được hoặc không có trên ảnh thì để null - tuyệt đối không suy đoán.
Chép đúng nguyên văn những gì nhìn thấy, không tự sửa chính tả.
Ngày tháng luôn trả về dạng YYYY-MM-DD; nếu ảnh ghi theo niên hiệu Nhật
(昭和/平成/令和) thì quy đổi sang dương lịch.`;

export const DOCUMENT_READERS: Record<WorkerDocumentType, DocumentReader> = {
  [WorkerDocumentType.PASSPORT_FIRST]: {
    label: 'Hộ chiếu trang đầu',
    prompt: `Đây là ảnh trang thông tin của hộ chiếu.
${COMMON_RULES}
Schema:
{
  "name": "họ và tên in hoa, đúng như dòng tên trên hộ chiếu",
  "dateOfBirth": "YYYY-MM-DD",
  "gender": "male hoặc female",
  "country": "quốc tịch, ghi bằng tiếng Việt, ví dụ: Việt Nam"
}`,
  },

  [WorkerDocumentType.PASSPORT_STAMP]: {
    label: 'Hộ chiếu trang có dấu xuất cảnh',
    prompt: `Đây là ảnh trang hộ chiếu có các dấu xuất nhập cảnh.
${COMMON_RULES}
Chỉ quan tâm tới dấu XUẤT CẢNH khỏi Nhật Bản (chữ 出国 hoặc DEPARTURE,
kèm tên cửa khẩu Nhật như NARITA, HANEDA, KANSAI, CHUBU, FUKUOKA).
Nếu có nhiều dấu xuất cảnh thì lấy dấu có ngày muộn nhất.
Schema:
{
  "leaveJapanDate": "YYYY-MM-DD, ngày rời Nhật Bản"
}`,
  },

  [WorkerDocumentType.RESIDENCE_CARD_FRONT]: {
    label: 'Thẻ ngoại kiều mặt trước',
    prompt: `Đây là ảnh mặt trước thẻ ngoại kiều Nhật Bản (在留カード).
${COMMON_RULES}
Tách riêng địa chỉ ở mục 住居地 thành đúng 3 phần, cắt theo quy tắc sau:
- addressJpPrefecture: CHỈ tên 都道府県 (kết thúc bằng 都/道/府/県)
- addressJpDistrict: phần từ sau 都道府県 đến hết tên 町域, tức là dừng NGAY TRƯỚC
  con số hoặc chữ số Nhật đầu tiên chỉ địa chỉ (一丁目, 1丁目, 96番地...)
- addressJpHouseNumber: TOÀN BỘ phần còn lại, gồm 丁目/番地/号, tên chung cư và số phòng

Ví dụ với 住居地 là "栃木県真岡市久下田西一丁目96番地3 マンションアプライ 105号":
  addressJpPrefecture   = "栃木県"
  addressJpDistrict     = "真岡市久下田西"
  addressJpHouseNumber  = "一丁目96番地3 マンションアプライ 105号"
Schema:
{
  "name": "họ và tên in hoa",
  "dateOfBirth": "YYYY-MM-DD",
  "gender": "male hoặc female",
  "addressJpPrefecture": "giữ nguyên tiếng Nhật",
  "addressJpDistrict": "giữ nguyên tiếng Nhật",
  "addressJpHouseNumber": "giữ nguyên tiếng Nhật",
  "occupation": "nội dung mục 在留資格 (tư cách lưu trú), giữ nguyên tiếng Nhật"
}`,
  },

  [WorkerDocumentType.RESIDENCE_CARD_BACK]: {
    label: 'Thẻ ngoại kiều mặt sau',
    prompt: `Đây là ảnh mặt sau thẻ ngoại kiều Nhật Bản (在留カード),
nơi ghi lịch sử thay đổi địa chỉ cư trú (住居地記載欄).
${COMMON_RULES}
Lấy địa chỉ MỚI NHẤT (dòng cuối cùng có nội dung), tách thành 3 phần như dưới.
Nếu mặt sau không ghi địa chỉ nào thì trả về null cho cả 3 trường.
Schema:
{
  "addressJpPrefecture": "chỉ tên 都道府県",
  "addressJpDistrict": "phần 市区町村 và 町域",
  "addressJpHouseNumber": "số nhà, tên chung cư, số phòng"
}`,
  },

  [WorkerDocumentType.NENKIN_BOOK]: {
    label: 'Sổ Nenkin',
    prompt: `Đây là ảnh sổ Nenkin Nhật Bản (年金手帳) hoặc thông báo số hiệu lương hưu cơ sở.
${COMMON_RULES}
Schema:
{
  "pensionNumber": "基礎年金番号, định dạng 4 số - 6 số, ví dụ 0850-919032",
  "nameFurigana": "họ tên bằng KATAKANA in trên sổ",
  "dateOfBirth": "YYYY-MM-DD"
}`,
  },

  [WorkerDocumentType.BANK]: {
    label: 'Giấy xác nhận tài khoản ngân hàng',
    prompt: `Đây là ảnh giấy xác nhận tài khoản ngân hàng (sổ tiết kiệm, sao kê
hoặc giấy xác nhận do ngân hàng cấp).
${COMMON_RULES}
Schema:
{
  "bankName": "tên ngân hàng",
  "bankBranchName": "tên chi nhánh",
  "bankSwiftCode": "mã SWIFT/BIC, 8 hoặc 11 ký tự",
  "bankBranchAddress": "địa chỉ chi nhánh",
  "bankAccountName": "tên chủ tài khoản",
  "bankAccountNumber": "số tài khoản, chỉ gồm chữ số"
}`,
  },
};

/**
 * Khi nhiều giấy tờ cùng đọc ra một trường thì tin giấy tờ nào trước.
 * Xếp theo thứ tự giảm dần độ tin cậy cho riêng từng trường - ví dụ ngày sinh
 * trên hộ chiếu đáng tin hơn trên sổ Nenkin (sổ Nenkin ghi theo niên hiệu Nhật,
 * phải quy đổi nên dễ sai hơn).
 *
 * Trường không khai báo ở đây thì lấy của giấy tờ nào đọc được cũng được.
 */
export const FIELD_SOURCE_PRIORITY: Partial<
  Record<string, WorkerDocumentType[]>
> = {
  name: [
    WorkerDocumentType.PASSPORT_FIRST,
    WorkerDocumentType.RESIDENCE_CARD_FRONT,
  ],
  dateOfBirth: [
    WorkerDocumentType.PASSPORT_FIRST,
    WorkerDocumentType.RESIDENCE_CARD_FRONT,
    WorkerDocumentType.NENKIN_BOOK,
  ],
  gender: [
    WorkerDocumentType.PASSPORT_FIRST,
    WorkerDocumentType.RESIDENCE_CARD_FRONT,
  ],
  country: [WorkerDocumentType.PASSPORT_FIRST],
  leaveJapanDate: [WorkerDocumentType.PASSPORT_STAMP],

  // Mặt sau thẻ ngoại kiều ghi địa chỉ mới nhất nên đứng trước mặt trước.
  addressJpPrefectureCode: [
    WorkerDocumentType.RESIDENCE_CARD_BACK,
    WorkerDocumentType.RESIDENCE_CARD_FRONT,
  ],
  addressJpDistrict: [
    WorkerDocumentType.RESIDENCE_CARD_BACK,
    WorkerDocumentType.RESIDENCE_CARD_FRONT,
  ],
  addressJpHouseNumber: [
    WorkerDocumentType.RESIDENCE_CARD_BACK,
    WorkerDocumentType.RESIDENCE_CARD_FRONT,
  ],
};

/** Số giấy tờ tối đa cho một lần gọi, tránh vượt hạn mức của Groq. */
export const MAX_DOCUMENTS_PER_REQUEST = 6;
