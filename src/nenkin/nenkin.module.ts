import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from 'src/entities/agent.entity';
import { NenkinDocumentEntity } from 'src/entities/nenkin-document.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { WorkerEntity } from 'src/entities/worker.entity';
import { UploadModule } from 'src/uploads/uploads.module';
import { NenkinController } from './nenkin.controller';
import { NenkinPdfService } from './services/nenkin-pdf.service';
import { NenkinService } from './services/nenkin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NenkinProcedureEntity,
      NenkinDocumentEntity,
      WorkerEntity,
      AgentEntity,
    ]),
    UploadModule,
  ],
  controllers: [NenkinController],
  providers: [NenkinService, NenkinPdfService],
  exports: [NenkinService],
})
export class NenkinModule {}
