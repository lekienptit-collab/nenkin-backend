/**
 * Dữ liệu tham chiếu (master data) dùng cho màn hình Người lao động /
 * Người đại diện / Thủ tục Nenkin.
 *
 * Đây là dữ liệu cố định (tỉnh thành, ngân hàng...) nên để thẳng trong code,
 * không tạo bảng riêng. Frontend lấy qua GET /master-data.
 */

export interface OptionItem {
  value: string;
  label: string;
}

/** Giới tính theo quy ước của mẫu đơn Nenkin: 0 = Nam, 1 = Nữ. */
export enum Gender {
  MALE = 0,
  FEMALE = 1,
}

/** Mã quốc gia dùng cho tài khoản ngân hàng (theo mã điện thoại quốc tế). */
export enum BankCountry {
  JAPAN = '81',
  VIETNAM = '84',
}

/** Thủ tục Nenkin lần 1 hay lần 2. */
export enum NenkinServiceType {
  FIRST = 1,
  SECOND = 2,
}

/** Trạng thái hồ sơ giấy tờ của 1 lần thủ tục. */
export enum PaperStatus {
  /** Chưa tạo hồ sơ lần nào. */
  NOT_CREATED = 1,
  /** Đã tạo hồ sơ nhưng thông tin người lao động còn thiếu. */
  INCOMPLETE = 2,
  /** Đã tạo hồ sơ và thông tin đầy đủ. */
  COMPLETE = 3,
}

/** Đã trả kết quả Nenkin cho người lao động hay chưa. */
export enum NenkinResult {
  NOT_YET = 0,
  RETURNED = 1,
}

/**
 * Trường hợp của người lao động khi làm thủ tục.
 * Người quay lại Nhật tự khai thuế nên không cần người đại diện nộp thuế.
 */
export enum WorkerCaseType {
  /** Về nước hẳn — cần người đại diện nộp thuế ở Nhật. */
  RETURN_HOME = 1,
  /** Quay lại Nhật — tự khai thuế, không cần người đại diện. */
  RETURN_JAPAN = 2,
}

export const WORKER_CASE_TYPES: OptionItem[] = [
  { value: '1', label: 'Về nước hẳn' },
  { value: '2', label: 'Quay lại Nhật' },
];

/** Chế độ lương hưu mà người lao động từng tham gia (mục 7 của 請求書). */
export enum PensionSchemeType {
  NATIONAL = 1,
  EMPLOYEES = 2,
  SEAMEN = 3,
  MUTUAL_AID = 4,
}

export const PENSION_SCHEMES: OptionItem[] = [
  { value: '1', label: '国民年金 — Bảo hiểm quốc dân' },
  { value: '2', label: '厚生年金保険 — Bảo hiểm lao động xã hội' },
  { value: '3', label: '船員保険 — Bảo hiểm hàng hải' },
  { value: '4', label: '共済組合 — Hiệp hội hỗ tương' },
];

/** Loại tài khoản ngân hàng của người đại diện. */
export enum BankAccountType {
  NORMAL = 1,
  CHECKING = 2,
  SAVING = 3,
}

export const BANK_ACCOUNT_TYPES: OptionItem[] = [
  { value: '1', label: 'Thông thường' },
  { value: '2', label: 'Séc' },
  { value: '3', label: 'Tiết kiệm' },
];

/** Giá trị đặc biệt cho ô select: người dùng tự nhập tay. */
export const OPTION_OTHERS = 'others';

/** Quan hệ giữa người lao động và người được uỷ quyền. */
export const AGENT_RELATIONS: OptionItem[] = [
  { value: '納税管理人', label: '納税管理人 - Người đại diện nộp thuế' },
  { value: '友達', label: '友達 - Bạn bè' },
  { value: 'others', label: 'Khác' },
];

/** 47 tỉnh/thành của Nhật Bản (mã theo thứ tự JIS). */
export const JP_PREFECTURES: OptionItem[] = [
  { value: '1', label: '北海道' },
  { value: '2', label: '青森県' },
  { value: '3', label: '岩手県' },
  { value: '4', label: '宮城県' },
  { value: '5', label: '秋田県' },
  { value: '6', label: '山形県' },
  { value: '7', label: '福島県' },
  { value: '8', label: '茨城県' },
  { value: '9', label: '栃木県' },
  { value: '10', label: '群馬県' },
  { value: '11', label: '埼玉県' },
  { value: '12', label: '千葉県' },
  { value: '13', label: '東京都' },
  { value: '14', label: '神奈川県' },
  { value: '15', label: '新潟県' },
  { value: '16', label: '富山県' },
  { value: '17', label: '石川県' },
  { value: '18', label: '福井県' },
  { value: '19', label: '山梨県' },
  { value: '20', label: '長野県' },
  { value: '21', label: '岐阜県' },
  { value: '22', label: '静岡県' },
  { value: '23', label: '愛知県' },
  { value: '24', label: '三重県' },
  { value: '25', label: '滋賀県' },
  { value: '26', label: '京都府' },
  { value: '27', label: '大阪府' },
  { value: '28', label: '兵庫県' },
  { value: '29', label: '奈良県' },
  { value: '30', label: '和歌山県' },
  { value: '31', label: '鳥取県' },
  { value: '32', label: '島根県' },
  { value: '33', label: '岡山県' },
  { value: '34', label: '広島県' },
  { value: '35', label: '山口県' },
  { value: '36', label: '徳島県' },
  { value: '37', label: '香川県' },
  { value: '38', label: '愛媛県' },
  { value: '39', label: '高知県' },
  { value: '40', label: '福岡県' },
  { value: '41', label: '佐賀県' },
  { value: '42', label: '長崎県' },
  { value: '43', label: '熊本県' },
  { value: '44', label: '大分県' },
  { value: '45', label: '宮崎県' },
  { value: '46', label: '鹿児島県' },
  { value: '47', label: '沖縄県' },
];

/** 63 tỉnh/thành của Việt Nam (giữ nguyên mã của hệ thống cũ). */
export const VN_PROVINCES: OptionItem[] = [
  { value: '50', label: 'Hà Nội' },
  { value: '51', label: 'Hà Giang' },
  { value: '52', label: 'Cao Bằng' },
  { value: '53', label: 'Bắc Kạn' },
  { value: '54', label: 'Tuyên Quang' },
  { value: '55', label: 'Lào Cai' },
  { value: '56', label: 'Điện Biên' },
  { value: '57', label: 'Lai Châu' },
  { value: '58', label: 'Sơn La' },
  { value: '59', label: 'Yên Bái' },
  { value: '60', label: 'Hòa Bình' },
  { value: '61', label: 'Thái Nguyên' },
  { value: '62', label: 'Lạng Sơn' },
  { value: '63', label: 'Quảng Ninh' },
  { value: '64', label: 'Bắc Giang' },
  { value: '65', label: 'Phú Thọ' },
  { value: '66', label: 'Vĩnh Phúc' },
  { value: '67', label: 'Bắc Ninh' },
  { value: '68', label: 'Hải Dương' },
  { value: '69', label: 'Hải Phòng' },
  { value: '70', label: 'Hưng Yên' },
  { value: '71', label: 'Thái Bình' },
  { value: '72', label: 'Hà Nam' },
  { value: '73', label: 'Nam Định' },
  { value: '74', label: 'Ninh Bình' },
  { value: '75', label: 'Thanh Hóa' },
  { value: '76', label: 'Nghệ An' },
  { value: '77', label: 'Hà Tĩnh' },
  { value: '78', label: 'Quảng Bình' },
  { value: '79', label: 'Quảng Trị' },
  { value: '80', label: 'Thừa Thiên Huế' },
  { value: '81', label: 'Đà Nẵng' },
  { value: '82', label: 'Quảng Nam' },
  { value: '83', label: 'Quảng Ngãi' },
  { value: '84', label: 'Bình Định' },
  { value: '85', label: 'Phú Yên' },
  { value: '86', label: 'Khánh Hòa' },
  { value: '87', label: 'Ninh Thuận' },
  { value: '88', label: 'Bình Thuận' },
  { value: '89', label: 'Kon Tum' },
  { value: '90', label: 'Gia Lai' },
  { value: '91', label: 'Đắk Lắk' },
  { value: '92', label: 'Đắk Nông' },
  { value: '93', label: 'Lâm Đồng' },
  { value: '94', label: 'Bình Phước' },
  { value: '95', label: 'Tây Ninh' },
  { value: '96', label: 'Bình Dương' },
  { value: '97', label: 'Đồng Nai' },
  { value: '98', label: 'Bà Rịa - Vũng Tàu' },
  { value: '99', label: 'Thành phố Hồ Chí Minh' },
  { value: '100', label: 'Long An' },
  { value: '101', label: 'Tiền Giang' },
  { value: '102', label: 'Bến Tre' },
  { value: '103', label: 'Trà Vinh' },
  { value: '104', label: 'Vĩnh Long' },
  { value: '105', label: 'Đồng Tháp' },
  { value: '106', label: 'An Giang' },
  { value: '107', label: 'Kiên Giang' },
  { value: '108', label: 'Cần Thơ' },
  { value: '109', label: 'Hậu Giang' },
  { value: '110', label: 'Sóc Trăng' },
  { value: '111', label: 'Bạc Liêu' },
  { value: '112', label: 'Cà Mau' },
];

export interface BankItem extends OptionItem {
  /** '81' = ngân hàng Nhật, '84' = ngân hàng Việt Nam. */
  country: string;
  /** Mã SWIFT/BIC; rỗng với ngân hàng trong nước Nhật. */
  swiftCode: string;
}

/** Danh sách ngân hàng cho ô chọn 'Tên ngân hàng'. */
export const BANKS: BankItem[] = [
  {
    value: '埼玉りそな銀行',
    label: '埼玉りそな銀行',
    country: '81',
    swiftCode: '',
  },
  { value: 'みずほ銀行', label: 'みずほ銀行', country: '81', swiftCode: '' },
  {
    value: '三井住友銀行',
    label: '三井住友銀行',
    country: '81',
    swiftCode: '',
  },
  {
    value: '三菱ＵＦＪ銀行',
    label: '三菱ＵＦＪ銀行',
    country: '81',
    swiftCode: '',
  },
  { value: 'りそな銀行', label: 'りそな銀行', country: '81', swiftCode: '' },
  { value: '青森銀行', label: '青森銀行', country: '81', swiftCode: '' },
  { value: '秋田銀行', label: '秋田銀行', country: '81', swiftCode: '' },
  { value: '足利銀行', label: '足利銀行', country: '81', swiftCode: '' },
  {
    value: '池田泉州銀行',
    label: '池田泉州銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '伊予銀行', label: '伊予銀行', country: '81', swiftCode: '' },
  { value: '岩手銀行', label: '岩手銀行', country: '81', swiftCode: '' },
  { value: '大分銀行', label: '大分銀行', country: '81', swiftCode: '' },
  {
    value: '大垣共立銀行',
    label: '大垣共立銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '沖縄銀行', label: '沖縄銀行', country: '81', swiftCode: '' },
  { value: '鹿児島銀行', label: '鹿児島銀行', country: '81', swiftCode: '' },
  {
    value: '関西みらい銀行',
    label: '関西みらい銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '北九州銀行', label: '北九州銀行', country: '81', swiftCode: '' },
  { value: '紀陽銀行', label: '紀陽銀行', country: '81', swiftCode: '' },
  { value: '京都銀行', label: '京都銀行', country: '81', swiftCode: '' },
  {
    value: 'きらぼし銀行',
    label: 'きらぼし銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '群馬銀行', label: '群馬銀行', country: '81', swiftCode: '' },
  { value: '佐賀銀行', label: '佐賀銀行', country: '81', swiftCode: '' },
  { value: '三十三銀行', label: '三十三銀行', country: '81', swiftCode: '' },
  { value: '滋賀銀行', label: '滋賀銀行', country: '81', swiftCode: '' },
  { value: '四国銀行', label: '四国銀行', country: '81', swiftCode: '' },
  { value: '静岡銀行', label: '静岡銀行', country: '81', swiftCode: '' },
  { value: '七十七銀行', label: '七十七銀行', country: '81', swiftCode: '' },
  { value: '清水銀行', label: '清水銀行', country: '81', swiftCode: '' },
  {
    value: '十八親和銀行',
    label: '十八親和銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '十六銀行', label: '十六銀行', country: '81', swiftCode: '' },
  { value: '荘内銀行', label: '荘内銀行', country: '81', swiftCode: '' },
  { value: '常陽銀行', label: '常陽銀行', country: '81', swiftCode: '' },
  { value: 'スルガ銀行', label: 'スルガ銀行', country: '81', swiftCode: '' },
  {
    value: '第四北越銀行',
    label: '第四北越銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '但馬銀行', label: '但馬銀行', country: '81', swiftCode: '' },
  { value: '筑邦銀行', label: '筑邦銀行', country: '81', swiftCode: '' },
  { value: '千葉銀行', label: '千葉銀行', country: '81', swiftCode: '' },
  {
    value: '千葉興業銀行',
    label: '千葉興業銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '中国銀行', label: '中国銀行', country: '81', swiftCode: '' },
  { value: '筑波銀行', label: '筑波銀行', country: '81', swiftCode: '' },
  { value: '東邦銀行', label: '東邦銀行', country: '81', swiftCode: '' },
  { value: '東北銀行', label: '東北銀行', country: '81', swiftCode: '' },
  { value: '鳥取銀行', label: '鳥取銀行', country: '81', swiftCode: '' },
  { value: '富山銀行', label: '富山銀行', country: '81', swiftCode: '' },
  { value: '南都銀行', label: '南都銀行', country: '81', swiftCode: '' },
  {
    value: '西日本シティ銀行',
    label: '西日本シティ銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '八十二銀行', label: '八十二銀行', country: '81', swiftCode: '' },
  { value: '肥後銀行', label: '肥後銀行', country: '81', swiftCode: '' },
  { value: '百五銀行', label: '百五銀行', country: '81', swiftCode: '' },
  { value: '百十四銀行', label: '百十四銀行', country: '81', swiftCode: '' },
  { value: '広島銀行', label: '広島銀行', country: '81', swiftCode: '' },
  { value: '福井銀行', label: '福井銀行', country: '81', swiftCode: '' },
  { value: '福岡銀行', label: '福岡銀行', country: '81', swiftCode: '' },
  { value: '北都銀行', label: '北都銀行', country: '81', swiftCode: '' },
  { value: '北陸銀行', label: '北陸銀行', country: '81', swiftCode: '' },
  { value: '北海道銀行', label: '北海道銀行', country: '81', swiftCode: '' },
  { value: '北國銀行', label: '北國銀行', country: '81', swiftCode: '' },
  {
    value: 'みちのく銀行',
    label: 'みちのく銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '宮崎銀行', label: '宮崎銀行', country: '81', swiftCode: '' },
  { value: '武蔵野銀行', label: '武蔵野銀行', country: '81', swiftCode: '' },
  { value: '山形銀行', label: '山形銀行', country: '81', swiftCode: '' },
  { value: '山口銀行', label: '山口銀行', country: '81', swiftCode: '' },
  {
    value: '山梨中央銀行',
    label: '山梨中央銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '横浜銀行', label: '横浜銀行', country: '81', swiftCode: '' },
  { value: '琉球銀行', label: '琉球銀行', country: '81', swiftCode: '' },
  { value: '愛知銀行', label: '愛知銀行', country: '81', swiftCode: '' },
  { value: '愛媛銀行', label: '愛媛銀行', country: '81', swiftCode: '' },
  {
    value: '沖縄海邦銀行',
    label: '沖縄海邦銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '香川銀行', label: '香川銀行', country: '81', swiftCode: '' },
  { value: '神奈川銀行', label: '神奈川銀行', country: '81', swiftCode: '' },
  { value: '北日本銀行', label: '北日本銀行', country: '81', swiftCode: '' },
  {
    value: 'きらやか銀行',
    label: 'きらやか銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '熊本銀行', label: '熊本銀行', country: '81', swiftCode: '' },
  { value: '京葉銀行', label: '京葉銀行', country: '81', swiftCode: '' },
  { value: '高知銀行', label: '高知銀行', country: '81', swiftCode: '' },
  { value: '西京銀行', label: '西京銀行', country: '81', swiftCode: '' },
  {
    value: '佐賀共栄銀行',
    label: '佐賀共栄銀行',
    country: '81',
    swiftCode: '',
  },
  {
    value: '静岡中央銀行',
    label: '静岡中央銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '仙台銀行', label: '仙台銀行', country: '81', swiftCode: '' },
  { value: '大光銀行', label: '大光銀行', country: '81', swiftCode: '' },
  { value: '大東銀行', label: '大東銀行', country: '81', swiftCode: '' },
  { value: '中京銀行', label: '中京銀行', country: '81', swiftCode: '' },
  { value: '東和銀行', label: '東和銀行', country: '81', swiftCode: '' },
  {
    value: '徳島大正銀行',
    label: '徳島大正銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '栃木銀行', label: '栃木銀行', country: '81', swiftCode: '' },
  { value: 'トマト銀行', label: 'トマト銀行', country: '81', swiftCode: '' },
  {
    value: '富山第一銀行',
    label: '富山第一銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '長崎銀行', label: '長崎銀行', country: '81', swiftCode: '' },
  { value: '長野銀行', label: '長野銀行', country: '81', swiftCode: '' },
  { value: '名古屋銀行', label: '名古屋銀行', country: '81', swiftCode: '' },
  { value: '東日本銀行', label: '東日本銀行', country: '81', swiftCode: '' },
  {
    value: '福岡中央銀行',
    label: '福岡中央銀行',
    country: '81',
    swiftCode: '',
  },
  { value: '福島銀行', label: '福島銀行', country: '81', swiftCode: '' },
  { value: '福邦銀行', label: '福邦銀行', country: '81', swiftCode: '' },
  { value: '豊和銀行', label: '豊和銀行', country: '81', swiftCode: '' },
  { value: '北洋銀行', label: '北洋銀行', country: '81', swiftCode: '' },
  { value: 'みなと銀行', label: 'みなと銀行', country: '81', swiftCode: '' },
  { value: '南日本銀行', label: '南日本銀行', country: '81', swiftCode: '' },
  {
    value: '宮崎太陽銀行',
    label: '宮崎太陽銀行',
    country: '81',
    swiftCode: '',
  },
  { value: 'もみじ銀行', label: 'もみじ銀行', country: '81', swiftCode: '' },
  {
    value: 'AGRIBANK',
    label: 'AGRIBANK',
    country: '84',
    swiftCode: 'VBAAVNVX',
  },
  {
    value: 'VIETINBANK',
    label: 'VIETINBANK',
    country: '84',
    swiftCode: 'ICBVVNVX',
  },
  { value: 'BIDV', label: 'BIDV', country: '84', swiftCode: 'BIDVVNVX' },
  {
    value: 'VIETCOMBANK',
    label: 'VIETCOMBANK',
    country: '84',
    swiftCode: 'BFTVVNVX',
  },
  {
    value: 'SACOMBANK',
    label: 'SACOMBANK',
    country: '84',
    swiftCode: 'SGTTVNVX',
  },
];

/** Tên các giấy tờ sinh ra cho từng lần thủ tục Nenkin. */
export const NENKIN_PAPER_TEMPLATES: Record<
  NenkinServiceType,
  { code: string; name: string }[]
> = {
  [NenkinServiceType.FIRST]: [
    {
      code: 'RequestApplication',
      name: 'Đơn đăng ký nhận trợ cấp lương hưu trọn gói (申請書)',
    },
    { code: 'EntrustApplication', name: 'Giấy uỷ quyền (委任状)' },
  ],
  // Sở thuế không còn yêu cầu bản lưu (控用) và 添付書類台紙 nên bộ hồ sơ lần 2
  // chỉ còn 4 tờ. Thứ tự giữ đúng như hệ thống cũ hiển thị.
  [NenkinServiceType.SECOND]: [
    { code: 'TaxManagerNotice', name: '所得税・消費税の納税管理人の届出書' },
    { code: 'DeclarationB', name: '申告書B（第一表）' },
    { code: 'DeclarationSeparate', name: '申告書（分離課税用・第三表）' },
    { code: 'FinalDeclarationB', name: '確定申告書B（第二表）' },
  ],
};

/**
 * Giấy tờ đính kèm, ghép từ ảnh người lao động đã tải lên chứ không phải mẫu
 * PDF điền sẵn. `fields` là các trường chứa URL ảnh trên hồ sơ người lao động;
 * mỗi ảnh có sẵn thành một trang trong giấy tờ đó.
 *
 * Danh sách và tên gọi giữ đúng như hệ thống cũ hiển thị ở thủ tục lần 1.
 */
export const SCANNED_PAPERS: Record<
  NenkinServiceType,
  { code: string; name: string; fields: string[] }[]
> = {
  [NenkinServiceType.FIRST]: [
    {
      code: 'PassportCopy',
      name: 'Hộ chiếu',
      fields: ['passportFirstPage', 'passportSecondPage', 'passportStampPage'],
    },
    {
      code: 'ResidenceCardCopy',
      name: 'Thẻ ngoại kiều',
      fields: ['residenceCardFrontImage', 'residenceCardBackImage'],
    },
    {
      code: 'NenkinBookCopy',
      name: 'Sổ Nenkin',
      fields: ['nenkinBookImage'],
    },
    {
      code: 'BankCertificateCopy',
      name: 'Giấy xác nhận tài khoản ngân hàng',
      fields: ['bankImage', 'bankImageBack'],
    },
  ],
  [NenkinServiceType.SECOND]: [],
};

/**
 * Giấy tờ chỉ dùng khi người lao động về nước hẳn.
 * Người quay lại Nhật tự khai thuế nên không cần chỉ định người đại diện nộp thuế.
 */
export const RETURN_HOME_ONLY_PAPERS = ['TaxManagerNotice'];

/** Bộ giấy tờ của một lần thủ tục, đã lọc theo trường hợp của người lao động. */
export const papersFor = (
  serviceType: NenkinServiceType,
  caseType: WorkerCaseType = WorkerCaseType.RETURN_HOME,
) =>
  (NENKIN_PAPER_TEMPLATES[serviceType] || []).filter(
    (p) =>
      caseType === WorkerCaseType.RETURN_HOME ||
      !RETURN_HOME_ONLY_PAPERS.includes(p.code),
  );

/**
 * Toàn bộ giấy tờ có trong bộ hồ sơ, gồm cả giấy tờ chỉ đính kèm bản scan.
 * Dùng để hiển thị cho người dùng biết bộ hồ sơ gồm những gì; còn `papersFor`
 * chỉ trả về các mẫu hệ thống tự điền nên đừng dùng nhầm khi sinh PDF.
 */
export const allPapersFor = (
  serviceType: NenkinServiceType,
  caseType: WorkerCaseType = WorkerCaseType.RETURN_HOME,
): { code: string; name: string; scanned: boolean }[] => [
  ...papersFor(serviceType, caseType).map((p) => ({ ...p, scanned: false })),
  ...(SCANNED_PAPERS[serviceType] || []).map((p) => ({
    code: p.code,
    name: p.name,
    scanned: true,
  })),
];
