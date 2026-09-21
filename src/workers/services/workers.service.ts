import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ErrorCode } from 'src/common/constatns/error';
import {
  NenkinResult,
  NenkinServiceType,
  PaperStatus,
} from 'src/common/constatns/master-data';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { NenkinDocumentEntity } from 'src/entities/nenkin-document.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { UploadService } from 'src/uploads/uploads.service';
import { WorkerInsuranceHistoryEntity } from 'src/entities/worker-insurance-history.entity';
import { WorkerEntity } from 'src/entities/worker.entity';
import { Brackets, In, Repository } from 'typeorm';
import {
  CreateWorkerDto,
  GetManyWorkerDto,
  InsuranceHistoryDto,
  UpdateNenkinResultDto,
  UpdateWorkerDto,
} from '../dto/worker.dto';
import { getMissingFields, MissingField } from './worker-completeness';

/** Người lao động kèm trạng thái hồ sơ đã tính sẵn cho frontend. */
export interface WorkerWithStatus extends WorkerEntity {
  firstPaperStatus: PaperStatus;
  secondPaperStatus: PaperStatus;
  firstMissingFields: MissingField[];
  secondMissingFields: MissingField[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

@Injectable()
export class WorkerService {
  constructor(
    @InjectRepository(WorkerEntity)
    private readonly workerRepo: Repository<WorkerEntity>,
    @InjectRepository(WorkerInsuranceHistoryEntity)
    private readonly historyRepo: Repository<WorkerInsuranceHistoryEntity>,
    @InjectRepository(NenkinProcedureEntity)
    private readonly procedureRepo: Repository<NenkinProcedureEntity>,
    @InjectRepository(NenkinDocumentEntity)
    private readonly documentRepo: Repository<NenkinDocumentEntity>,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Trạng thái hồ sơ của một lần thủ tục:
   * chưa tạo -> NOT_CREATED, đã tạo mà thiếu dữ liệu -> INCOMPLETE, đủ -> COMPLETE.
   */
  private paperStatus(
    worker: WorkerEntity,
    serviceType: NenkinServiceType,
    hasProcedure: boolean,
  ): { status: PaperStatus; missing: MissingField[] } {
    const missing = getMissingFields(worker, serviceType);
    if (!hasProcedure) {
      return { status: PaperStatus.NOT_CREATED, missing };
    }
    return {
      status:
        missing.length > 0 ? PaperStatus.INCOMPLETE : PaperStatus.COMPLETE,
      missing,
    };
  }

  /** Gắn trạng thái hồ sơ vào danh sách người lao động (1 query cho cả danh sách). */
  private async withStatus(
    workers: WorkerEntity[],
  ): Promise<WorkerWithStatus[]> {
    if (workers.length === 0) {
      return [];
    }
    const procedures = await this.procedureRepo.find({
      where: { workerId: In(workers.map((w) => w.id)) },
      select: ['workerId', 'serviceType'],
    });

    const done = new Set(
      procedures.map((p) => `${p.workerId}:${p.serviceType}`),
    );

    return workers.map((w) => {
      const first = this.paperStatus(
        w,
        NenkinServiceType.FIRST,
        done.has(`${w.id}:${NenkinServiceType.FIRST}`),
      );
      const second = this.paperStatus(
        w,
        NenkinServiceType.SECOND,
        done.has(`${w.id}:${NenkinServiceType.SECOND}`),
      );
      return {
        ...w,
        firstPaperStatus: first.status,
        secondPaperStatus: second.status,
        firstMissingFields: first.missing,
        secondMissingFields: second.missing,
      };
    });
  }

  async getMany(options: GetManyWorkerDto = {}) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0
        ? Math.min(options.limit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const qb = this.workerRepo
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.createdBy', 'createdBy')
      .leftJoinAndSelect('w.insuranceHistories', 'histories')
      .orderBy('w.createAt', 'DESC')
      .addOrderBy('histories.sortOrder', 'ASC');

    if (options.keyword?.trim()) {
      const keyword = `%${options.keyword.trim()}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where('w.name LIKE :keyword', { keyword })
            .orWhere('w.nameFurigana LIKE :keyword', { keyword })
            .orWhere('w.pensionNumber LIKE :keyword', { keyword })
            .orWhere('w.phoneNumber LIKE :keyword', { keyword })
            .orWhere('w.addressVnAddress LIKE :keyword', { keyword });
        }),
      );
    }
    if (options.createdById) {
      qb.andWhere('w.createdById = :createdById', {
        createdById: options.createdById,
      });
    }
    if (options.fromDate) {
      qb.andWhere('w.createAt >= :fromDate', {
        fromDate: `${options.fromDate} 00:00:00`,
      });
    }
    if (options.toDate) {
      qb.andWhere('w.createAt <= :toDate', {
        toDate: `${options.toDate} 23:59:59`,
      });
    }
    if (typeof options.nenkinFirstResult === 'number') {
      qb.andWhere('w.nenkinFirstResult = :r1', {
        r1: options.nenkinFirstResult,
      });
    }
    if (typeof options.nenkinSecondResult === 'number') {
      qb.andWhere('w.nenkinSecondResult = :r2', {
        r2: options.nenkinSecondResult,
      });
    }

    // Trạng thái hồ sơ phải tính từ dữ liệu người lao động nên không lọc được
    // bằng SQL. Lấy toàn bộ kết quả đã lọc ở DB rồi lọc tiếp và phân trang ở đây.
    const needStatusFilter =
      !!options.firstPaperStatus ||
      !!options.secondPaperStatus ||
      !!options.paperStatus ||
      options.hasLackingInfo !== undefined;

    if (!needStatusFilter) {
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return this.buildPage(await this.withStatus(data), total, page, limit);
    }

    const all = await this.withStatus(await qb.getMany());
    const filtered = all.filter(
      (w) =>
        (!options.firstPaperStatus ||
          w.firstPaperStatus === options.firstPaperStatus) &&
        (!options.secondPaperStatus ||
          w.secondPaperStatus === options.secondPaperStatus) &&
        this.matchPaperStatus(w, options.paperStatus) &&
        this.matchLackingInfo(w, options.hasLackingInfo),
    );
    const paged = filtered.slice((page - 1) * limit, page * limit);
    return this.buildPage(paged, filtered.length, page, limit);
  }

  /**
   * Lọc nhanh không phân biệt lần: "chưa làm" và "thiếu" khớp khi ít nhất một
   * lần ở trạng thái đó, còn "đủ giấy tờ" đòi hỏi cả hai lần đều đủ.
   */
  private matchPaperStatus(w: WorkerWithStatus, status?: PaperStatus): boolean {
    if (!status) {
      return true;
    }
    if (status === PaperStatus.COMPLETE) {
      return (
        w.firstPaperStatus === PaperStatus.COMPLETE &&
        w.secondPaperStatus === PaperStatus.COMPLETE
      );
    }
    return w.firstPaperStatus === status || w.secondPaperStatus === status;
  }

  /** Người lao động còn thiếu trường bắt buộc nào không (cho cả 2 lần). */
  private matchLackingInfo(w: WorkerWithStatus, lacking?: boolean): boolean {
    if (lacking === undefined) {
      return true;
    }
    const isLacking =
      w.firstMissingFields.length > 0 || w.secondMissingFields.length > 0;
    return isLacking === lacking;
  }

  private buildPage(
    data: WorkerWithStatus[],
    total: number,
    page: number,
    limit: number,
  ) {
    return {
      data,
      total,
      count: data.length,
      page,
      pageCount: Math.ceil(total / limit),
    };
  }

  /** Danh sách rút gọn cho ô chọn người lao động ở màn hình thủ tục Nenkin. */
  async search(keyword?: string) {
    const qb = this.workerRepo
      .createQueryBuilder('w')
      .select(['w.id', 'w.name', 'w.dateOfBirth', 'w.pensionNumber'])
      .orderBy('w.createAt', 'DESC')
      .take(50);

    if (keyword?.trim()) {
      const k = `%${keyword.trim()}%`;
      qb.where('w.name LIKE :k', { k }).orWhere('w.pensionNumber LIKE :k', {
        k,
      });
    }

    const data = await qb.getMany();
    return { data, total: data.length };
  }

  async getOne(id: number): Promise<WorkerWithStatus> {
    const worker = await this.workerRepo.findOne({
      where: { id },
      relations: ['createdBy', 'insuranceHistories'],
      order: { insuranceHistories: { sortOrder: 'ASC' } },
    });
    if (!worker) {
      throw new CBadRequestException(ErrorCode.WORKER_NOT_FOUND);
    }
    const [withStatus] = await this.withStatus([worker]);
    return withStatus;
  }

  /** Bản ghi thô, dùng nội bộ khi không cần tính trạng thái. */
  async getEntity(id: number): Promise<WorkerEntity> {
    const worker = await this.workerRepo.findOne({
      where: { id },
      relations: ['insuranceHistories'],
      order: { insuranceHistories: { sortOrder: 'ASC' } },
    });
    if (!worker) {
      throw new CBadRequestException(ErrorCode.WORKER_NOT_FOUND);
    }
    return worker;
  }

  async create(payload: CreateWorkerDto, userId?: string) {
    const { insuranceHistories, ...rest } = payload;
    const worker = this.workerRepo.create({
      ...rest,
      country: rest.country || 'Việt Nam',
      createdById: userId,
      updatedById: userId,
    });
    const saved = await this.workerRepo.save(worker);
    await this.replaceHistories(saved.id, insuranceHistories);
    return this.getOne(saved.id);
  }

  async update(id: number, payload: UpdateWorkerDto, userId?: string) {
    await this.getEntity(id);
    const { insuranceHistories, ...rest } = payload;
    await this.workerRepo.update(id, { ...rest, updatedById: userId });
    if (insuranceHistories !== undefined) {
      await this.replaceHistories(id, insuranceHistories);
    }
    return this.getOne(id);
  }

  /** Bảng lịch sử luôn ghi đè toàn bộ: form gửi lên tập dòng hiện tại. */
  private async replaceHistories(
    workerId: number,
    histories?: InsuranceHistoryDto[],
  ) {
    await this.historyRepo.delete({ workerId });
    if (!histories?.length) {
      return;
    }
    const rows = histories
      .filter((h) => h.workPlace || h.address || h.fromDate || h.toDate)
      .map((h, index) =>
        this.historyRepo.create({ ...h, workerId, sortOrder: index }),
      );
    if (rows.length > 0) {
      await this.historyRepo.save(rows);
    }
  }

  async updateNenkinResult(id: number, payload: UpdateNenkinResultDto) {
    await this.getEntity(id);
    const isFirst = payload.serviceType === NenkinServiceType.FIRST;

    const values: Record<string, any> = {
      [isFirst ? 'nenkinFirstResult' : 'nenkinSecondResult']: payload.result,
    };
    // Bỏ tích "đã trả kết quả" chỉ đổi trạng thái, giữ nguyên ngày: ngày có
    // kết quả lần 1 còn là dữ liệu bắt buộc của thủ tục lần 2.
    if (payload.result === NenkinResult.RETURNED && payload.resultDate) {
      values[isFirst ? 'resultDate1' : 'resultDate2'] = payload.resultDate;
    }

    await this.workerRepo.update(id, values);
    return this.getOne(id);
  }

  /** Các trường của người lao động có chứa đường dẫn file ảnh giấy tờ. */
  private static readonly IMAGE_FIELDS = [
    'passportFirstPage',
    'passportSecondPage',
    'passportStampPage',
    'leftProofUrl',
    'residenceCardFrontImage',
    'residenceCardBackImage',
    'nenkinBookImage',
    'bankImage',
    'bankImageBack',
  ];

  async deleteMulti(ids: number[]) {
    if (!ids?.length) {
      return { success: true };
    }

    // Xoá kèm file trên đĩa: ảnh giấy tờ và PDF hồ sơ đều chứa dữ liệu cá nhân
    // (họ tên, ngày sinh, số tài khoản, mã số lương hưu) nên không để lại sau
    // khi người dùng đã xoá. Cần file PDF lại thì tạo lại hồ sơ là có.
    const workers = await this.workerRepo.find({ where: { id: In(ids) } });
    for (const worker of workers) {
      for (const field of WorkerService.IMAGE_FIELDS) {
        this.uploadService.removeByPublicUrl(worker[field]);
      }
      this.uploadService.removeDirectory(`nenkin-output/${worker.id}`);
    }

    // Hồ sơ Nenkin xoá hẳn chứ không xoá mềm: file PDF đã bị xoá ở trên nên
    // giữ lại bản ghi chỉ tạo ra hồ sơ trỏ vào file không còn tồn tại, đồng
    // thời chặn oan việc xoá người đại diện đứng tên trên đó.
    const procedures = await this.procedureRepo.find({
      where: { workerId: In(ids) },
      select: ['id'],
    });
    if (procedures.length > 0) {
      const procedureIds = procedures.map((p) => p.id);
      await this.documentRepo.delete({ procedureId: In(procedureIds) });
      await this.procedureRepo.delete(procedureIds);
    }

    await this.workerRepo.softDelete(ids);
    return { success: true };
  }
}
