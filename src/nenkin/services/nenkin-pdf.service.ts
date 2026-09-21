import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import * as fontkitModule from '@pdf-lib/fontkit';
import {
  NENKIN_PAPER_TEMPLATES,
  NenkinServiceType,
} from 'src/common/constatns/master-data';
import { AgentEntity } from 'src/entities/agent.entity';
import { NenkinDocumentStatus } from 'src/entities/nenkin-document.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { WorkerEntity } from 'src/entities/worker.entity';
import { PAPER_TEMPLATES } from '../templates';
import { Draw, FillContext, resolveCoord } from '../templates/types';

export interface GenerateResult {
  documents: GeneratedDocument[];
  /** URL file gộp cả bộ, undefined khi chưa sinh được giấy tờ nào. */
  mergedFileUrl?: string;
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

  constructor(private readonly config: ConfigService) {}

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
    const papers = NENKIN_PAPER_TEMPLATES[serviceType] || [];
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

    const mergedFileUrl =
      filled.length > 0
        ? await this.saveMerged(context, serviceType, filled)
        : undefined;
    return { documents: results, mergedFileUrl };
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

  /** Điền dữ liệu lên mẫu PDF, trả về nội dung file kết quả. */
  private async fillTemplate(
    code: string,
    context: NenkinDocumentContext,
  ): Promise<Uint8Array> {
    const doc = await PDFDocument.load(readFileSync(this.templatePath(code)));
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(this.loadFont(), { subset: true });
    const pages = doc.getPages();

    for (const draw of PAPER_TEMPLATES[code].draws) {
      const page = pages[draw.page ?? 0];
      if (page) {
        this.applyDraw(page, font, draw, context);
      }
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
  ) {
    if (draw.kind === 'circle') {
      if (draw.when && !draw.when(context)) return;
      const cx = resolveCoord(draw.cx, context);
      const cy = resolveCoord(draw.cy, context);
      if (cx === undefined || cy === undefined) return;
      page.drawEllipse({
        x: cx,
        y: cy,
        xScale: draw.rx,
        yScale: draw.ry,
        borderWidth: 1.2,
        borderColor: rgb(0, 0, 0),
        opacity: 0,
      });
      return;
    }

    const text = draw.value(context);
    if (!text) {
      return;
    }

    if (draw.kind === 'text') {
      const x = resolveCoord(draw.x, context);
      const y = resolveCoord(draw.y, context);
      if (x === undefined || y === undefined) return;
      page.drawText(text, { x, y, size: draw.size, font });
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
