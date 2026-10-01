import { Module } from '@nestjs/common';
import { UploadModule } from 'src/uploads/uploads.module';
import { OcrController } from './ocr.controller';
import { OpenAIVisionService } from './services/openai-vision.service';
import { WorkerOcrService } from './services/worker-ocr.service';

@Module({
  imports: [UploadModule],
  controllers: [OcrController],
  providers: [OpenAIVisionService, WorkerOcrService],
  exports: [WorkerOcrService],
})
export class OcrModule {}
