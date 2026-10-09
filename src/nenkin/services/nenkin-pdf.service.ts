import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  LineCapStyle,
  PageSizes,
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
} from 'pdf-lib';
import * as fontkitModule from '@pdf-lib/fontkit';
import {
  NenkinServiceType,
  papersFor,
  SCANNED_FIELD_LABELS,
  scannedPapersFor,
} from 'src/common/constatns/master-data';
import { AgentEntity } from 'src/entities/agent.entity';
import { NenkinDocumentStatus } from 'src/entities/nenkin-document.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { WorkerEntity } from 'src/entities/worker.entity';
import { UploadService } from 'src/uploads/uploads.service';
import { PAPER_TEMPLATES } from '../templates';
import { Draw, FillContext, resolveCoord } from '../templates/types';
import {
  AttachmentError,
  AttachmentPart,
  embedAttachment,
} from './attachment-embedder';

export interface GenerateResult {
  documents: GeneratedDocument[];
  /** URL file gộp cả bộ, undefined khi chưa sinh được giấy tờ nào. */
  mergedFileUrl?: string;
  /** Ảnh/file giấy tờ đã tải lên nhưng không đưa được vào bộ hồ sơ. */
  unreadableFiles: UnreadableFile[];
}

export interface UnreadableFile {
  /** Tên giấy tờ đính kèm, ví dụ "Hộ chiếu". */
  paper: string;
  /** Trường lưu URL ảnh trên hồ sơ người lao động. */
  field: string;
  /** Tên ô ảnh trên form, ví dụ "Trang có dấu xuất cảnh". */
  label: string;
  reason: string;
}

export interface GeneratedDocument {
  code: string;
  name: string;
  fileUrl?: string;
  status: NenkinDocumentStatus;
  sortOrder: number;
}

export interface NenkinDocumentContext {
  procedure: NenkinProcedureEntity;
  worker: WorkerEntity;
  agent?: AgentEntity;
}

// @pdf-lib/fontkit xuất theo kiểu ES module, còn dự án biên dịch ra CommonJS,
// nên phải lấy `default` khi có.
const fontkit = (fontkitModule as any).default ?? fontkitModule;

/** Ký tự font có sẵn, và các ký tự đã in mà font không có. */
interface GlyphCheck {
  charset: Set<number>;
  missing: Set<string>;
}

/** Tên file gộp cả bộ hồ sơ để xem trước / tải về. */
const MERGED_NAME: Record<NenkinServiceType, string> = {
  [NenkinServiceType.FIRST]: 'first_papers.pdf',
  [NenkinServiceType.SECOND]: 'second_papers.pdf',
};

/**
 * Sinh bộ giấy tờ PDF cho một lần thủ tục Nenkin.
 *
 * Mỗi giấy tờ là một mẫu PDF trắng của cơ quan Nhật Bản, đặt tại
 * `assets/nenkin-templates/<code>.pdf`, được in đè dữ liệu người lao động lên
 * theo bảng toạ độ khai báo trong `src/nenkin/templates/`.
 *
 * Thiếu file mẫu thì giấy tờ vẫn được ghi nhận nhưng ở trạng thái PENDING,
 * để luồng nghiệp vụ không bị chặn.
 */
@Injectable()
export class NenkinPdfService {
  private readonly logger = new Logger(NenkinPdfService.name);
  /** Font 6MB, đọc một lần rồi dùng lại cho mọi lần sinh file. */
  private fontBytes?: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly uploadService: UploadService,
  ) {}

  private get storageRoot(): string {
    return this.config.get<string>('storage.root');
  }

  private get publicPath(): string {
    return this.config.get<string>('storage.publicPath');
  }

  /**
   * Mẫu PDF trắng nằm trong `assets/` chứ không phải `storage/`: đây là tài sản
   * của ứng dụng, cần đi kèm mã nguồn, không phải dữ liệu người dùng tải lên.
   */
  private templatePath(code: string): string {
    return join(process.cwd(), 'assets', 'nenkin-templates', `${code}.pdf`);
  }

  /** Mẫu PDF của giấy tờ này đã được cung cấp chưa. */
  hasTemplate(code: string): boolean {
    return existsSync(this.templatePath(code));
  }

  async generate(
    context: NenkinDocumentContext,
    serviceType: NenkinServiceType,
  ): Promise<GenerateResult> {
    // Bộ giấy tờ đổi theo trường hợp: người quay lại Nhật không cần tờ chỉ định
    // người đại diện nộp thuế.
    const papers = papersFor(serviceType, context.procedure.caseType);
    const results: GeneratedDocument[] = [];
    const filled: Uint8Array[] = [];

    for (const [index, paper] of papers.entries()) {
      if (!this.hasTemplate(paper.code) || !PAPER_TEMPLATES[paper.code]) {
        this.logger.warn(
          `Chưa có mẫu PDF cho "${paper.code}", giấy tờ ghi nhận ở trạng thái PENDING`,
        );
        results.push({
          ...paper,
          status: NenkinDocumentStatus.PENDING,
          sortOrder: index,
        });
        continue;
      }

      const bytes = await this.fillTemplate(paper.code, context);
      filled.push(bytes);
      results.push({
        ...paper,
        fileUrl: this.save(context, `${index + 1}.${paper.code}.pdf`, bytes),
        status: NenkinDocumentStatus.GENERATED,
        sortOrder: index,
      });
    }

    // Giấy tờ đính kèm: không có mẫu để điền, chỉ đưa ảnh người lao động đã
    // tải lên vào các trang A4 rồi ghép vào cuối bộ hồ sơ.
    const unreadableFiles: UnreadableFile[] = [];
    for (const scanned of scannedPapersFor(
      serviceType,
      context.procedure.caseType,
    )) {
      const { bytes, unreadable } = await this.attachmentsToPdf(
        context.worker,
        scanned.fields,
        scanned.onePage,
      );
      unreadableFiles.push(
        ...unreadable.map((u) => ({ paper: scanned.name, ...u })),
      );
      const sortOrder = results.length;
      if (!bytes) {
        results.push({
          code: scanned.code,
          name: scanned.name,
          status: NenkinDocumentStatus.PENDING,
          sortOrder,
        });
        continue;
      }
      filled.push(bytes);
      results.push({
        code: scanned.code,
        name: scanned.name,
        fileUrl: this.save(
          context,
          `${sortOrder + 1}.${scanned.code}.pdf`,
          bytes,
        ),
        status: NenkinDocumentStatus.GENERATED,
        sortOrder,
      });
    }

    const mergedFileUrl =
      filled.length > 0
        ? await this.saveMerged(context, serviceType, filled)
        : undefined;
    return { documents: results, mergedFileUrl, unreadableFiles };
  }

  private relativeDir(
    context: NenkinDocumentContext,
    serviceType?: NenkinServiceType,
  ): string {
    const type = serviceType ?? context.procedure.serviceType;
    return `nenkin-output/${context.worker.id}/${type}`;
  }

  private save(
    context: NenkinDocumentContext,
    fileName: string,
    bytes: Uint8Array,
  ): string {
    const relative = this.relativeDir(context);
    const dir = join(this.storageRoot, relative);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, fileName), bytes);
    return `${this.publicPath}/${relative}/${fileName}`;
  }

  /** Ghép tất cả giấy tờ thành một file để xem trước và in một lượt. */
  private async saveMerged(
    context: NenkinDocumentContext,
    serviceType: NenkinServiceType,
    parts: Uint8Array[],
  ): Promise<string> {
    const merged = await PDFDocument.create();
    for (const part of parts) {
      const doc = await PDFDocument.load(part);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    return this.save(context, MERGED_NAME[serviceType], await merged.save());
  }

  /**
   * Ghép các file giấy tờ (ảnh, hoặc từng trang của file PDF) thành một file
   * PDF: mặc định mỗi ảnh/trang một trang A4, `onePage` thì xếp tất cả lên
   * cùng một trang, từ trên xuống theo thứ tự.
   *
   * File không đọc được thì bỏ qua và trả về trong `unreadable` để báo người
   * dùng; `bytes` là null khi không còn ảnh nào dùng được.
   */
  private async attachmentsToPdf(
    worker: WorkerEntity,
    fields: string[],
    onePage = false,
  ): Promise<{
    bytes: Uint8Array | null;
    unreadable: Omit<UnreadableFile, 'paper'>[];
  }> {
    const doc = await PDFDocument.create();
    const parts: AttachmentPart[] = [];
    const unreadable: Omit<UnreadableFile, 'paper'>[] = [];

    for (const field of fields) {
      const url = worker[field] as string | undefined;
      if (!url) {
        continue;
      }
      try {
        const fullPath = this.uploadService.resolvePublicUrl(url);
        if (!fullPath) {
          throw new AttachmentError('Không tìm thấy file trên máy chủ');
        }
        parts.push(...(await embedAttachment(doc, readFileSync(fullPath))));
      } catch (error) {
        const known = error instanceof AttachmentError;
        const reason = known ? error.message : 'Không đọc được nội dung file';
        const detail = known ? error.detail : error;
        this.logger.warn(
          `Không đưa được "${url}" (${field}) vào PDF: ${reason}` +
            (detail ? ` — ${detail}` : ''),
        );
        unreadable.push({
          field,
          label: SCANNED_FIELD_LABELS[field] ?? field,
          reason,
        });
      }
    }

    if (parts.length === 0) {
      return { bytes: null, unreadable };
    }
    for (const group of onePage ? [parts] : parts.map((p) => [p])) {
      this.drawStacked(doc.addPage(PageSizes.A4), group);
    }
    return { bytes: await doc.save(), unreadable };
  }

  /**
   * Xếp các ảnh từ trên xuống trong một trang A4: mỗi ảnh được một phần chiều
   * cao bằng nhau, thu nhỏ giữ đúng tỉ lệ (không phóng to ảnh nhỏ), cả cụm
   * căn giữa trang.
   */
  private drawStacked(page: PDFPage, parts: AttachmentPart[]) {
    const margin = 40;
    const gap = parts.length > 1 ? 24 : 0;
    const maxWidth = page.getWidth() - margin * 2;
    const slotHeight =
      (page.getHeight() - margin * 2 - gap * (parts.length - 1)) / parts.length;

    const sizes = parts.map((part) => {
      const scale = Math.min(
        maxWidth / part.width,
        slotHeight / part.height,
        1,
      );
      return { width: part.width * scale, height: part.height * scale };
    });
    const total =
      sizes.reduce((sum, s) => sum + s.height, 0) + gap * (parts.length - 1);

    // Toạ độ PDF tính từ mép dưới: ảnh đầu tiên (mặt trước) nằm trên cùng.
    let top = (page.getHeight() + total) / 2;
    parts.forEach((part, i) => {
      const { width, height } = sizes[i];
      part.draw(page, {
        x: (page.getWidth() - width) / 2,
        y: top - height,
        width,
        height,
      });
      top -= height + gap;
    });
  }

  /** Điền dữ liệu lên mẫu PDF, trả về nội dung file kết quả. */
  private async fillTemplate(
    code: string,
    context: NenkinDocumentContext,
  ): Promise<Uint8Array> {
    const doc = await PDFDocument.load(readFileSync(this.templatePath(code)));
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(this.loadFont(), { subset: true });
    const pages = doc.getPages();
    const glyphs: GlyphCheck = {
      charset: new Set(font.getCharacterSet()),
      missing: new Set(),
    };

    for (const draw of PAPER_TEMPLATES[code].draws) {
      const page = pages[draw.page ?? 0];
      if (page) {
        this.applyDraw(page, font, draw, context, glyphs);
      }
    }

    // Font không có ký tự nào thì chỗ đó in thành hình hộp ☒ mà không báo lỗi
    // gì (như dấu ✔ ở ô 永住許可 trước đây, hoặc tên có dấu tiếng Việt "Ễ").
    if (glyphs.missing.size > 0) {
      this.logger.warn(
        `Mẫu ${code}: font không có ký tự ${[...glyphs.missing]
          .map((ch) => `"${ch}" (U+${ch.codePointAt(0).toString(16)})`)
          .join(', ')} — chỗ đó sẽ in thành ô trống`,
      );
    }
    return doc.save();
  }

  private loadFont(): Buffer {
    if (!this.fontBytes) {
      this.fontBytes = readFileSync(
        join(process.cwd(), 'assets', 'fonts', 'ipaexg.ttf'),
      );
    }
    return this.fontBytes;
  }

  private applyDraw(
    page: PDFPage,
    font: PDFFont,
    draw: Draw,
    context: FillContext,
    glyphs: GlyphCheck,
  ) {
    if (draw.kind === 'circle') {
      if (draw.when && !draw.when(context)) return;
      const cx = resolveCoord(draw.cx, context);
      const cy = resolveCoord(draw.cy, context);
      const rx = resolveCoord(draw.rx, context);
      const ry = resolveCoord(draw.ry, context);
      if (
        cx === undefined ||
        cy === undefined ||
        rx === undefined ||
        ry === undefined
      ) {
        return;
      }
      page.drawEllipse({
        x: cx,
        y: cy,
        xScale: rx,
        yScale: ry,
        borderWidth: 1.2,
        borderColor: rgb(0, 0, 0),
        opacity: 0,
      });
      return;
    }

    if (draw.kind === 'check') {
      if (draw.when && !draw.when(context)) return;
      // Chữ V: nét ngắn đi xuống rồi nét dài đi lên, đầu nét bo tròn.
      const { x, y, size } = draw;
      const left = { x: x + size * 0.18, y: y + size * 0.5 };
      const bottom = { x: x + size * 0.42, y: y + size * 0.18 };
      const right = { x: x + size * 0.86, y: y + size * 0.88 };
      const stroke = {
        thickness: size * 0.12,
        color: rgb(0, 0, 0),
        lineCap: LineCapStyle.Round,
      };
      page.drawLine({ start: left, end: bottom, ...stroke });
      page.drawLine({ start: bottom, end: right, ...stroke });
      return;
    }

    if (draw.kind === 'line') {
      page.drawLine({
        start: { x: draw.x1, y: draw.y1 },
        end: { x: draw.x2, y: draw.y2 },
        thickness: draw.thickness,
        color: rgb(0, 0, 0),
      });
      return;
    }

    const text = draw.value(context);
    if (!text) {
      return;
    }
    for (const ch of text) {
      if (ch.trim() && !glyphs.charset.has(ch.codePointAt(0))) {
        glyphs.missing.add(ch);
      }
    }

    if (draw.kind === 'text') {
      const x = resolveCoord(draw.x, context);
      const y = resolveCoord(draw.y, context);
      if (x === undefined || y === undefined) return;
      let size = draw.size;
      if (draw.maxWidth) {
        const width = font.widthOfTextAtSize(text, size);
        if (width > draw.maxWidth) {
          size = Math.max(draw.minSize ?? 5, (size * draw.maxWidth) / width);
        }
      }
      page.drawText(text, { x, y, size, font });
      return;
    }

    if (draw.kind === 'chars') {
      const y = resolveCoord(draw.y, context);
      if (y === undefined) return;
      const chars = [...text].slice(0, draw.xs.length);
      // Dồn phải thì ký tự cuối rơi vào ô cuối cùng.
      const offset = draw.align === 'right' ? draw.xs.length - chars.length : 0;
      chars.forEach((ch, i) =>
        page.drawText(ch, { x: draw.xs[offset + i], y, size: draw.size, font }),
      );
      return;
    }

    const x = resolveCoord(draw.x, context);
    if (x === undefined) return;
    for (const [i, y] of draw.ys.entries()) {
      const line = [...text]
        .slice(i * draw.perLine, (i + 1) * draw.perLine)
        .join('');
      if (line) {
        page.drawText(line, { x, y, size: draw.size, font });
      }
    }
  }
}
