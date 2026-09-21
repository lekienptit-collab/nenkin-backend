# Nenkin Backend

Backend NestJS + TypeORM (MySQL) + Redis.

Nền tảng: **Đăng nhập, Quản lý thành viên, Quyền, Phân quyền**.
Nghiệp vụ: **Người lao động, Người đại diện, Thủ tục Nenkin**.

## Stack

| Thành phần | Công nghệ |
| --- | --- |
| Framework | NestJS 9 |
| ORM | TypeORM 0.3 |
| Database | MySQL 8 |
| Cache | Redis 7 (`cache-manager-redis-store`) |
| Auth | JWT (`passport-jwt`) + refresh token lưu DB |
| Docs | Swagger tại `/swagger` |

## Chạy dự án

```bash
cp .env.example .env     # sửa lại nếu cần

# 1. Bật MySQL + Redis
docker compose up -d

# 2. Cài đặt và chạy backend
npm install
npm run start:dev
```

Backend chạy ở `http://127.0.0.1:3900` (theo `PORT` trong `.env`), Swagger ở `/swagger`.

`docker-compose.yml` nằm ngay trong thư mục này và đọc biến từ `.env` cùng thư mục,
nên không cần file cấu hình nào ở ngoài.

> **`docker-compose.yml` chỉ dựng MySQL + Redis.** Backend luôn chạy trực tiếp trên máy
> bằng `npm run start:dev` / `npm run start:prod`, không chạy trong Docker — nhờ vậy sửa
> code là hot-reload ngay, không phải build lại image.

Các lệnh hay dùng:

```bash
docker compose ps          # xem trạng thái MySQL/Redis
docker compose logs -f     # xem log
docker compose down        # tắt, vẫn giữ dữ liệu
docker compose down -v     # tắt và xoá sạch dữ liệu (seed lại từ đầu)
```

Lần chạy đầu tiên hệ thống tự động:

1. Seed 3 role mặc định: `admin` (toàn quyền) → `manager` → `member`.
2. Tạo tài khoản admin từ `ADMIN_USERNAME` / `ADMIN_PASSWORD` trong `.env`
   (mặc định `admin` / `Admin@123`).

Bảng được tạo bằng migration (xem mục bên dưới), không phải bằng `synchronize`.

**Hệ thống không có đăng ký công khai.** Tài khoản mới chỉ được tạo bởi người có quyền
`CREATE_USER`, qua `POST /users` hoặc màn hình *Quản lý thành viên* trên giao diện.

## Cấu trúc thư mục

```
src/
├── main.ts                  # bootstrap, CORS, ValidationPipe, Swagger
├── app.module.ts            # TypeORM + Redis cache + các module nghiệp vụ
├── ormconfig.ts             # DataSource cho TypeORM CLI (migration)
├── entities/                # UserEntity, RoleEntity, SessionEntity, ...
├── migrations/              # file migration do TypeORM CLI sinh ra
├── common/
│   ├── config/              # app / database / redis config
│   ├── constatns/           # RolePers, PermissionGroup, ErrorCode, JWT
│   ├── decorator/           # TokenGuard, RolesGuard, @CUseRoles, @CurrentUser, @RealIP
│   ├── exceptions/          # CBadRequestException, HttpExceptionFilter
│   └── util/, dto/, validator/
├── auth/                    # đăng nhập, refresh/logout token
├── roles/                   # CRUD quyền + seed + nạp grants vào Redis
├── users/                   # CRUD thành viên + /me (hồ sơ, đổi mật khẩu)
├── uploads/                 # tải ảnh giấy tờ lên kho file cục bộ
├── ocr/                     # đọc giấy tờ bằng AI (Groq) -> gợi ý điền form
├── master-data/             # tỉnh thành, ngân hàng + tra mã bưu điện Nhật
├── workers/                 # CRUD người lao động + trạng thái hồ sơ Nenkin
├── agents/                  # CRUD người đại diện (người được uỷ quyền)
└── nenkin/                  # hồ sơ thủ tục Nenkin lần 1 / lần 2 + giấy tờ
```

## Migration

```bash
yarn migrate:generate    # so sánh entity với DB, sinh file trong src/migrations/
yarn migrate:up          # chạy các migration chưa áp dụng
yarn migrate:down        # revert migration gần nhất
yarn migrate:create      # tạo migration rỗng để tự viết SQL
```

Migration đã chạy được ghi vào bảng `history`.

Hai điều dễ vướng:

**1. `DATABASE_SYNCHRONIZE` phải là `false`.** Khi bật `true`, TypeORM tự đồng bộ schema
lúc khởi động nên DB luôn khớp entity — `migrate:generate` sẽ báo
*"No changes in database schema were found"* và không sinh ra file nào.

**2. `src/ormconfig.ts` chỉ được export DUY NHẤT một `DataSource`.** Nếu file vừa có
`export const AppDataSource` vừa có `export default AppDataSource`, TypeORM CLI đếm được
2 export và báo lỗi:

```
Error: Given data source file must contain only one export of DataSource instance
```

Lưu ý `ormconfig.ts` đọc `.env` riêng (qua `dotenv`), độc lập với `ConfigModule` của
NestJS — nên chạy CLI từ thư mục gốc của project để nó tìm đúng file `.env`.

## Cơ chế phân quyền

1. Mỗi `role` có mảng `permissions`. Quyền đặc biệt `all` = toàn quyền.
2. `InitRoleService` nạp toàn bộ role vào Redis key `roles_grants` dạng
   `{ roleId: { PERMISSION: true } }`, và nạp lại mỗi khi role thay đổi.
3. Route được bảo vệ bằng `@UseGuards(TokenGuard, RolesGuard)` + `@CUseRoles(RolePers.X)`.
   `RolesGuard` đọc `roles_grants` từ Redis nên không phải query DB mỗi request.
4. Role có quan hệ cha–con (`roleId`). Role con **không được vượt quá** quyền của role cha:
   - Khi tạo/sửa role, `normalizePermissions()` cắt bớt quyền ngoài phạm vi role cha.
   - Khi thu hẹp quyền role cha, `syncChildrenPermissions()` tự cắt quyền các role con.

Thêm permission mới: khai báo trong `RolePers` rồi thêm vào `PermissionGroup`
(`src/common/constatns/role.ts`). Frontend tự đọc qua `GET /roles/permissions` nên không
cần sửa gì thêm ngoài phần nhãn tiếng Việt.

## Quản lý phiên đăng nhập

- Mỗi lần đăng nhập tạo 1 bản ghi trong bảng `sessions` (access token + refresh token).
- Payload JWT có thêm `jti` ngẫu nhiên. Không có `jti` thì 2 lần đăng nhập trong cùng một
  giây sẽ sinh ra JWT giống hệt nhau (payload chỉ khác `iat`/`exp` tính theo giây),
  khiến việc đăng xuất một phiên làm chết luôn phiên còn lại.
- Đăng xuất / refresh / đổi mật khẩu / khoá tài khoản đều đánh dấu token cũ vào Redis
  (`LO.<token>`), `TokenGuard` kiểm tra dấu này trước khi verify JWT.

## API

### Auth (không cần token)

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/auth/login` | Đăng nhập bằng username hoặc email |
| POST | `/token/refresh` | Cấp lại access token |
| DELETE | `/token` | Đăng xuất |
| GET | `/health` | Health check |

### Me (cần token)

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/me` | Hồ sơ tài khoản hiện tại |
| GET | `/me/permissions` | Danh sách permission đã resolve |
| PATCH | `/me` | Cập nhật hồ sơ |
| PATCH | `/me/password` | Đổi mật khẩu (thu hồi mọi phiên cũ) |

### Users

| Method | Endpoint | Permission |
| --- | --- | --- |
| GET | `/users` | `GET_USER` |
| GET | `/users/:id` | `GET_USER` |
| POST | `/users` | `CREATE_USER` |
| PATCH | `/users/:id` | `UPDATE_USER` |
| PATCH | `/users/ban/:id` | `BANED_USER` |
| DELETE | `/users` | `DELETE_USER` |
| GET | `/users-search` | chỉ cần token |

### Roles

| Method | Endpoint | Permission |
| --- | --- | --- |
| GET | `/roles` | `GET_ROLES` |
| GET | `/roles/:id` | `GET_ROLES` |
| POST | `/roles` | `CREATE_ROLES` |
| PATCH | `/roles/:id` | `UPDATE_ROLES` |
| DELETE | `/roles/:id` | `DELETE_ROLES` |
| GET | `/roles/permissions` | chỉ cần token |
| GET | `/roles/search` | chỉ cần token |
| GET | `/roles/permission-to-customer/:id` | chỉ cần token |

## Nghiệp vụ Nenkin

### Trạng thái hồ sơ của người lao động

Mỗi người lao động có 2 trạng thái, một cho thủ tục lần 1 và một cho lần 2. Trạng thái
**không lưu trong DB** mà tính lại mỗi lần đọc, từ 2 yếu tố: đã tạo hồ sơ chưa, và dữ
liệu người lao động đã đủ chưa.

| Giá trị | Ý nghĩa |
| --- | --- |
| `1` | Chưa làm — chưa tạo hồ sơ lần này |
| `2` | Thiếu hoặc chưa đủ thông tin — đã tạo hồ sơ nhưng người lao động còn thiếu dữ liệu |
| `3` | Đầy đủ |

Danh sách trường bắt buộc nằm ở `src/workers/services/worker-completeness.ts`.
Sửa yêu cầu nghiệp vụ thì chỉ cần sửa 2 mảng `FIRST_REQUIRED_FIELDS` và
`SECOND_ONLY_REQUIRED_FIELDS` — API trả kèm `firstMissingFields` / `secondMissingFields`
để giao diện hiện đúng danh sách còn thiếu.

### Hồ sơ thủ tục

- Mỗi người lao động có tối đa **1 hồ sơ cho mỗi lần thủ tục** (ràng buộc unique
  `worker_id` + `service_type`). Gọi lại `POST /nenkin/procedures` là cập nhật hồ sơ cũ
  và sinh lại toàn bộ giấy tờ.
- Thủ tục lần 2 (khai thuế) chỉ làm được sau khi đã có hồ sơ lần 1 — nếu chưa,
  API trả `NENKIN_FIRST_REQUIRED`.
- Hồ sơ vẫn tạo được khi người lao động thiếu thông tin; phần thiếu trả về trong
  `missingFields` để giao diện cảnh báo.

### Sinh file PDF

Mỗi lần tạo hồ sơ, hệ thống in dữ liệu người lao động đè lên mẫu PDF chính thức của
Nhật Bản rồi ghép cả bộ thành một file để in một lượt.

| Lần | Mẫu | Mã (tên file mẫu) |
| --- | --- | --- |
| 1 | 脱退一時金請求書 | `RequestApplication` |
| 1 | 委任状 | `EntrustApplication` |
| 2 | 所得税・消費税の納税管理人の届出書 | `TaxManagerNotice` |
| 2 | 申告書B 第一表 | `DeclarationB` |
| 2 | 申告書（分離課税用）第三表 | `DeclarationSeparate` |
| 2 | 確定申告書B 第二表 | `FinalDeclarationB` |

Sở thuế không còn yêu cầu bản lưu 控用 và 添付書類台紙 nên bộ hồ sơ lần 2 chỉ còn 4 tờ.

**Mẫu PDF trắng** nằm ở `assets/nenkin-templates/<mã>.pdf` và được commit cùng mã nguồn
(đây là tài sản của ứng dụng, khác với `storage/` chứa file người dùng tải lên).

**Bảng toạ độ** của từng mẫu nằm ở `src/nenkin/templates/`, mỗi mẫu một file. Toạ độ
tính theo hệ của PDF: gốc ở góc dưới-trái tờ giấy, đơn vị point. Có 4 kiểu lệnh in:

| Kiểu | Dùng cho |
| --- | --- |
| `text` | Một chuỗi bắt đầu từ (x, y) |
| `chars` | Điền từng ký tự vào các ô kẻ sẵn; `align: 'right'` để dồn phải cho ô tiền |
| `lines` | Chuỗi dài tự xuống dòng, mỗi dòng một y |
| `circle` | Khoanh tròn một lựa chọn in sẵn (niên hiệu, giới tính, loại tài khoản) |

Toạ độ `x`/`y` nhận cả hàm, dùng khi vị trí phụ thuộc dữ liệu — ví dụ vòng khoanh niên
hiệu nằm ở dòng khác nhau cho 昭和 / 平成 / 令和.

**Font**: `assets/fonts/ipaexg.ttf` (IPAex Gothic, giấy phép IPA Font License 1.0,
được phép phân phối kèm sản phẩm). Không dùng Noto Sans JP vì bản CJK chỉ có định dạng
OTF/CFF mà pdf-lib không subset được, còn bản variable font thì mất glyph.

Thiếu file mẫu hoặc thiếu bảng toạ độ thì giấy tờ vẫn được ghi nhận nhưng ở trạng thái
`PENDING`, luồng nghiệp vụ không bị chặn.

### Sửa vị trí các ô trên mẫu

Toạ độ hiện tại được đo từ chính file mà hệ thống cũ sinh ra, nên kết quả trùng khớp
từng ô. Khi cần chỉnh, cách nhanh nhất là mở file PDF đã sinh, đo lại toạ độ ô cần sửa
rồi cập nhật con số trong `src/nenkin/templates/`.

Một vài quy ước rút ra từ hệ thống cũ, đã hiện thực sẵn:

- Ô chữ Latin luôn viết in hoa và **bỏ dấu tiếng Việt** (`Việt Nam` → `VIET NAM`).
- Mã SWIFT 8 ký tự được đệm `XXX` cho đủ 11 ô trên 脱退一時金請求書.
- Ngân hàng trong nước Nhật thì bỏ trống mã SWIFT và ghi thêm tên tài khoản Katakana.
- Ô 〒 trên 委任状 luôn in `000-0000` vì địa chỉ người lao động ở nước ngoài.
- Năm khai thuế trên 3 tờ thuế lấy theo **năm nhận kết quả Nenkin lần 1**.
- Trang 3 của 脱退一時金請求書 (mục 7 — lịch sử tham gia chế độ lương hưu) **không được
  in**, giống hệ thống cũ; phôi mẫu chỉ giữ 2 trang đầu.

## Đọc giấy tờ bằng AI (OCR)

Ảnh giấy tờ đã tải lên được gửi cho **Groq** để đọc và điền sẵn form người lao động.

### Cấu hình

```bash
GROQ_API_KEY=...                      # lấy ở https://console.groq.com/keys
GROQ_MODEL=qwen/qwen3.8-27b           # BẮT BUỘC là model nhận được ảnh
```

Để trống `GROQ_API_KEY` là tắt tính năng: `GET /ocr/status` trả `enabled: false`,
giao diện tự ẩn khối OCR, mọi trường vẫn nhập tay bình thường.

**Model phải nhận được ảnh.** Kiểm tra bằng `GET https://api.groq.com/openai/v1/models`
và tìm model có `"input_modalities"` chứa `"image"` — phần lớn model trên Groq chỉ nhận
text. Tại thời điểm viết, `qwen/qwen3.8-27b` là model vision khả dụng.

### Luồng xử lý

1. Người dùng tải ảnh lên qua `POST /uploads/image`, nhận về URL.
2. Giao diện gửi các URL đó kèm loại giấy tờ tới `POST /ocr/worker-documents`.
3. Backend đọc file từ đĩa, gửi ảnh base64 + prompt riêng cho từng loại giấy tờ,
   bắt model trả JSON (`response_format: json_object`).
4. Kết quả thô được chuẩn hoá về đúng tên và kiểu trường của form
   (giới tính → 0/1, tên tỉnh tiếng Nhật → mã tỉnh, mã SWIFT → quốc gia ngân hàng...).
5. Giao diện hiện bảng đối chiếu để người dùng **duyệt trước khi điền** — AI chỉ gợi ý,
   không bao giờ tự ghi vào hồ sơ.

### Thêm / sửa loại giấy tờ

Tất cả nằm trong `src/ocr/ocr.constants.ts`:

- `WorkerDocumentType` — danh sách loại giấy tờ.
- `DOCUMENT_READERS` — nhãn và prompt của từng loại. Prompt mô tả schema JSON mong muốn;
  nên kèm ví dụ cụ thể cho những chỗ dễ nhầm (ví dụ cách cắt địa chỉ Nhật thành
  都道府県 / 市区町村 / 番地).
- `FIELD_SOURCE_PRIORITY` — khi nhiều giấy tờ cùng đọc ra một trường thì tin ai trước.
  Ví dụ ngày sinh lấy từ hộ chiếu chứ không lấy từ sổ Nenkin, vì sổ Nenkin ghi theo
  niên hiệu Nhật nên phải quy đổi, dễ sai hơn.

Service và controller không phải sửa gì khi thêm loại giấy tờ mới.

### Giới hạn tốc độ

Gói miễn phí của Groq giới hạn khoảng **7.000 token đầu vào mỗi phút**, mỗi ảnh tốn
~1.900 token, tức chỉ đọc được khoảng 3 ảnh/phút. Vì vậy:

- Các ảnh được gọi **tuần tự**, không song song (gọi song song là dính 429 ngay).
- Gặp 429 thì chờ đúng số giây Groq đề nghị rồi thử lại, tối đa `GROQ_MAX_RETRIES` lần.
- Đọc đủ 6 ảnh mất khoảng 60-90 giây. Ảnh nào vẫn lỗi thì trả `OCR_RATE_LIMITED`
  trong `results[]`, giao diện hiện cảnh báo riêng cho ảnh đó chứ không hỏng cả lần đọc.

### Lưu ý về dữ liệu cá nhân

Ảnh hộ chiếu, thẻ ngoại kiều, sổ Nenkin của người lao động sẽ được gửi sang máy chủ của
Groq để xử lý. Cần bảo đảm việc này phù hợp với thoả thuận xử lý dữ liệu cá nhân mà công
ty đang áp dụng trước khi bật tính năng trên môi trường thật.

## Kho file

Ảnh giấy tờ và file PDF sinh ra được lưu trên đĩa tại `storage.root`
(mặc định `<thư mục backend>/storage`) và phục vụ tĩnh qua `storage.publicPath`
(mặc định `/media`). Đổi sang S3/GCS chỉ cần thay `src/uploads/uploads.service.ts`.

`POST /uploads/image` nhận `multipart/form-data` (field `file`), giới hạn kiểu
`jpeg/png/webp/heic/pdf` và dung lượng `STORAGE_MAX_FILE_SIZE`, trả về `{ url, name }`.

**Xoá người lao động thì xoá kèm file trên đĩa** — cả ảnh giấy tờ lẫn thư mục PDF hồ sơ.
Ảnh hộ chiếu, thẻ ngoại kiều và các tờ khai đều chứa dữ liệu cá nhân (họ tên, ngày sinh,
số tài khoản, mã số lương hưu) nên không giữ lại sau khi đã xoá. Bản ghi trong DB vẫn là
xoá mềm; cần lại file PDF thì tạo lại hồ sơ là có.

## Quy ước lỗi

Mọi lỗi HTTP trả về dạng `{ "msg": "<ERROR_CODE>", "data": <chi tiết> }`
(xem `src/common/exceptions/http-exception.filter.ts`).
Danh sách mã lỗi ở `src/common/constatns/error.ts`.

## Biến môi trường

Xem đầy đủ trong `.env.example`. Các biến quan trọng:

| Biến | Giá trị đang dùng | Ghi chú |
| --- | --- | --- |
| `PORT` | 3900 | Mặc định NestJS là 3000, máy này 3000/3001 đang bị chiếm |
| `DATABASE_PORT` | 33062 | Cổng MySQL phía host |
| `DATABASE_PASSWROD` | nenkin | Giữ nguyên cách viết sai chính tả theo T-connect |
| `DATABASE_SYNCHRONIZE` | false | Để `false` khi dùng migration |
| `REDIS_PORT` | 63792 | 63791 đang bị project khác chiếm trên máy này |
| `STORAGE_ROOT` | `<backend>/storage` | Kho ảnh giấy tờ + PDF hồ sơ Nenkin |
| `STORAGE_PUBLIC_PATH` | /media | Tiền tố URL phục vụ file tĩnh |
| `STORAGE_MAX_FILE_SIZE` | 10485760 | 10MB mỗi file |
| `GROQ_API_KEY` | - | Để trống = tắt OCR |
| `GROQ_MODEL` | qwen/qwen3.8-27b | Phải là model nhận được ảnh |
| `GROQ_MAX_RETRIES` | 2 | Số lần thử lại khi bị giới hạn tốc độ |
| `JWT_SECRET` | - | **Bắt buộc đổi trên production** |
| `ADMIN_PASSWORD` | Admin@123 | Mật khẩu admin khởi tạo |
