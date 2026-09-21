import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  MAX_DOCUMENTS_PER_REQUEST,
  WorkerDocumentType,
} from '../ocr.constants';

export class WorkerDocumentDto {
  @ApiProperty({ enum: WorkerDocumentType })
  @IsEnum(WorkerDocumentType)
  type: WorkerDocumentType;

  @ApiProperty({
    description: 'URL ảnh do POST /uploads/image trả về',
    example: '/media/uploads/202609/abc.jpg',
  })
  @IsString()
  @IsNotEmpty()
  url: string;
}

export class ExtractWorkerDocumentsDto {
  @ApiProperty({ type: [WorkerDocumentDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_DOCUMENTS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => WorkerDocumentDto)
  documents: WorkerDocumentDto[];
}
