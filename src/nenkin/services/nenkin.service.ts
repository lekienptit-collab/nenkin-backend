import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ErrorCode } from 'src/common/constatns/error';
import {
  NenkinServiceType,
  WorkerCaseType,
} from 'src/common/constatns/master-data';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { AgentEntity } from 'src/entities/agent.entity';
import { NenkinDocumentEntity } from 'src/entities/nenkin-document.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { WorkerEntity } from 'src/entities/worker.entity';
import { getMissingFields } from 'src/workers/services/worker-completeness';
import { Repository } from 'typeorm';
import { CreateNenkinProcedureDto, GetProceduresDto } from '../dto/nenkin.dto';
import { NenkinPdfService } from './nenkin-pdf.service';

@Injectable()
export class NenkinService {
  constructor(
    @InjectRepository(NenkinProcedureEntity)
    private readonly procedureRepo: Repository<NenkinProcedureEntity>,
    @InjectRepository(NenkinDocumentEntity)
    private readonly documentRepo: Repository<NenkinDocumentEntity>,
    @InjectRepository(WorkerEntity)
    private readonly workerRepo: Repository<WorkerEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    private readonly pdfService: NenkinPdfService,
  ) {}

  async getMany(params: GetProceduresDto = {}) {
    const where: Record<string, any> = {};
    if (params.workerId) where.workerId = params.workerId;
    if (params.serviceType) where.serviceType = params.serviceType;

    const data = await this.procedureRepo.find({
      where,
      relations: ['agent', 'documents', 'createdBy'],
      order: { serviceType: 'ASC', createAt: 'DESC' },
    });
    return { data, total: data.length };
  }

  async getOne(id: number) {
    const procedure = await this.procedureRepo.findOne({
      where: { id },
      relations: ['agent', 'worker', 'documents', 'createdBy'],
    });
    if (!procedure) {
      throw new CBadRequestException(ErrorCode.NENKIN_PROCEDURE_NOT_FOUND);
    }
    return procedure;
  }

  /**
   * Tạo hồ sơ Nenkin, hoặc cập nhật lại nếu người lao động đã làm lần này rồi.
   * Mỗi lần chạy sẽ sinh lại toàn bộ bộ giấy tờ.
   */
  async createOrUpdate(payload: CreateNenkinProcedureDto, userId?: string) {
    const worker = await this.workerRepo.findOne({
      where: { id: payload.workerId },
      relations: ['insuranceHistories'],
    });
    if (!worker) {
      throw new CBadRequestException(ErrorCode.WORKER_NOT_FOUND);
    }

    // Người quay lại Nhật tự khai thuế nên không gắn người đại diện.
    const caseType = payload.caseType ?? WorkerCaseType.RETURN_HOME;
    const needsAgent = caseType === WorkerCaseType.RETURN_HOME;

    let agent: AgentEntity | undefined;
    if (payload.agentId) {
      agent = await this.agentRepo.findOne({ where: { id: payload.agentId } });
      if (!agent) {
        throw new CBadRequestException(ErrorCode.AGENT_NOT_FOUND);
      }
    } else if (needsAgent) {
      throw new CBadRequestException(ErrorCode.AGENT_NOT_FOUND);
    }

    const isSecond = payload.serviceType === NenkinServiceType.SECOND;

    // Lần 2 là khai thuế sau khi đã có kết quả lần 1, nên bắt buộc lần 1 xong trước.
    if (isSecond) {
      const first = await this.procedureRepo.findOne({
        where: {
          workerId: payload.workerId,
          serviceType: NenkinServiceType.FIRST,
        },
      });
      if (!first) {
        throw new CBadRequestException(ErrorCode.NENKIN_FIRST_REQUIRED);
      }
      // Ngày có kết quả lần 1 nhập ở màn hình này thì lưu luôn về hồ sơ NLĐ.
      if (payload.resultDate1) {
        worker.resultDate1 = payload.resultDate1;
        await this.workerRepo.update(worker.id, {
          resultDate1: payload.resultDate1,
        });
      }
    }

    const existing = await this.procedureRepo.findOne({
      where: {
        workerId: payload.workerId,
        serviceType: payload.serviceType,
      },
    });

    const values: Partial<NenkinProcedureEntity> = {
      workerId: payload.workerId,
      agentId: needsAgent ? payload.agentId : null,
      serviceType: payload.serviceType,
      caseType,
      relation: needsAgent ? payload.relation : null,
      requestDate: isSecond ? null : payload.requestDate,
      entrustDate: isSecond ? null : payload.entrustDate,
      taxRequestDate: isSecond ? payload.taxRequestDate : null,
      taxEntrustDate: isSecond ? payload.taxEntrustDate : null,
      taxOffice: isSecond ? payload.taxOffice : null,
    };

    let procedure: NenkinProcedureEntity;
    if (existing) {
      await this.procedureRepo.update(existing.id, values);
      procedure = await this.procedureRepo.findOne({
        where: { id: existing.id },
      });
    } else {
      procedure = await this.procedureRepo.save(
        this.procedureRepo.create({ ...values, createdById: userId }),
      );
    }

    await this.regenerateDocuments(procedure, worker, agent);

    return {
      ...(await this.getOne(procedure.id)),
      // Vẫn cho tạo hồ sơ khi thiếu thông tin (giống hệ thống cũ), nhưng báo
      // rõ còn thiếu gì để người dùng bổ sung.
      missingFields: getMissingFields(worker, payload.serviceType),
    };
  }

  private async regenerateDocuments(
    procedure: NenkinProcedureEntity,
    worker: WorkerEntity,
    agent: AgentEntity,
  ) {
    const { documents, mergedFileUrl } = await this.pdfService.generate(
      { procedure, worker, agent },
      procedure.serviceType,
    );

    await this.documentRepo.delete({ procedureId: procedure.id });
    await this.documentRepo.save(
      documents.map((d) =>
        this.documentRepo.create({ ...d, procedureId: procedure.id }),
      ),
    );
    await this.procedureRepo.update(procedure.id, {
      mergedFileUrl: mergedFileUrl ?? null,
    });
  }

  async getDocument(id: number) {
    const document = await this.documentRepo.findOne({
      where: { id },
      relations: ['procedure', 'procedure.worker'],
    });
    if (!document) {
      throw new CBadRequestException(ErrorCode.NENKIN_DOCUMENT_NOT_FOUND);
    }
    if (!document.fileUrl) {
      throw new CBadRequestException(ErrorCode.NENKIN_TEMPLATE_NOT_CONFIGURED, {
        code: document.code,
        name: document.name,
      });
    }
    return document;
  }

  async deleteProcedure(id: number) {
    await this.getOne(id);
    await this.documentRepo.delete({ procedureId: id });
    await this.procedureRepo.delete(id);
    return { success: true };
  }
}
