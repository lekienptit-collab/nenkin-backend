import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NenkinDocumentEntity } from 'src/entities/nenkin-document.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { WorkerInsuranceHistoryEntity } from 'src/entities/worker-insurance-history.entity';
import { WorkerEntity } from 'src/entities/worker.entity';
import { UploadModule } from 'src/uploads/uploads.module';
import { WorkerService } from './services/workers.service';
import { WorkerController } from './workers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkerEntity,
      WorkerInsuranceHistoryEntity,
      NenkinProcedureEntity,
      NenkinDocumentEntity,
    ]),
    UploadModule,
  ],
  controllers: [WorkerController],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
