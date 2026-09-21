import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolePers } from 'src/common/constatns/role';
import { TokenGuard } from 'src/common/decorator/auth.decorator';
import { RolesGuard } from 'src/common/decorator/roles.guard';
import { CUseRoles } from 'src/common/decorator/user.role';
import { ExtractWorkerDocumentsDto } from './dto/ocr.dto';
import { DOCUMENT_READERS, WorkerDocumentType } from './ocr.constants';
import { WorkerOcrService } from './services/worker-ocr.service';

@ApiTags('OCR')
@Controller('ocr')
@ApiBearerAuth()
export class OcrController {
  constructor(private readonly service: WorkerOcrService) {}

  @Get('/status')
  @UseGuards(TokenGuard)
  @ApiOperation({
    description: 'Tính năng đọc giấy tờ bằng AI đã cấu hình hay chưa',
  })
  async status() {
    return {
      enabled: this.service.isConfigured,
      documentTypes: Object.values(WorkerDocumentType).map((type) => ({
        type,
        label: DOCUMENT_READERS[type].label,
      })),
    };
  }

  @Post('/worker-documents')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.CREATE_WORKER, RolePers.UPDATE_WORKER)
  @ApiOperation({
    description:
      'Đọc ảnh giấy tờ bằng AI, trả về gợi ý để điền form người lao động',
  })
  async extract(@Body() payload: ExtractWorkerDocumentsDto) {
    return this.service.extract(payload);
  }
}
