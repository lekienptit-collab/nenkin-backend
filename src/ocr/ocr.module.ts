import { Module } from '@nestjs/common';
import { UploadModule } from 'src/uploads/uploads.module';
import { OcrController } from './ocr.controller';
import { OpenAIVisionService } from './services/openai-vision.service';
import { WorkerOcrService } from './services/worker-ocr.service';

@Module({
  imports: [UploadModule],
  controllers: [OcrController],
  providers: [OpenAIVisionService, WorkerOcrService],
  // OpenAIVisionService dùng lại ở master-data để chọn sở thuế khi một quận
  // chia cho nhiều sở.
  exports: [WorkerOcrService, OpenAIVisionService],
})
export class OcrModule {}
