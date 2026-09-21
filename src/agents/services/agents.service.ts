import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ErrorCode } from 'src/common/constatns/error';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { AgentEntity } from 'src/entities/agent.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { Brackets, In, Repository } from 'typeorm';
import {
  CreateAgentDto,
  GetManyAgentDto,
  UpdateAgentDto,
} from '../dto/agent.dto';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(NenkinProcedureEntity)
    private readonly procedureRepo: Repository<NenkinProcedureEntity>,
  ) {}

  async getMany(options: GetManyAgentDto = {}) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0
        ? Math.min(options.limit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const qb = this.agentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.createdBy', 'createdBy')
      .orderBy('a.createAt', 'DESC');

    if (options.keyword?.trim()) {
      const keyword = `%${options.keyword.trim()}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where('a.name LIKE :keyword', { keyword })
            .orWhere('a.nameFurigana LIKE :keyword', { keyword })
            .orWhere('a.phoneNumber LIKE :keyword', { keyword });
        }),
      );
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      count: data.length,
      page,
      pageCount: Math.ceil(total / limit),
    };
  }

  /** Danh sách rút gọn cho ô chọn người được uỷ quyền. */
  async search(keyword?: string) {
    const qb = this.agentRepo
      .createQueryBuilder('a')
      .select(['a.id', 'a.name', 'a.nameFurigana', 'a.phoneNumber'])
      .orderBy('a.createAt', 'DESC')
      .take(50);

    if (keyword?.trim()) {
      const k = `%${keyword.trim()}%`;
      qb.where('a.name LIKE :k', { k }).orWhere('a.nameFurigana LIKE :k', {
        k,
      });
    }

    const data = await qb.getMany();
    return { data, total: data.length };
  }

  async getOne(id: number): Promise<AgentEntity> {
    const agent = await this.agentRepo.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!agent) {
      throw new CBadRequestException(ErrorCode.AGENT_NOT_FOUND);
    }
    return agent;
  }

  async create(payload: CreateAgentDto, userId?: string) {
    const agent = this.agentRepo.create({
      ...payload,
      createdById: userId,
      updatedById: userId,
    });
    const saved = await this.agentRepo.save(agent);
    return this.getOne(saved.id);
  }

  async update(id: number, payload: UpdateAgentDto, userId?: string) {
    await this.getOne(id);
    await this.agentRepo.update(id, { ...payload, updatedById: userId });
    return this.getOne(id);
  }

  async deleteMulti(ids: number[]) {
    if (!ids?.length) {
      return { success: true };
    }
    // Người đại diện đã đứng tên trên hồ sơ thì không cho xoá, tránh làm
    // hồ sơ Nenkin mất thông tin người được uỷ quyền.
    const inUse = await this.procedureRepo.count({
      where: { agentId: In(ids) },
    });
    if (inUse > 0) {
      throw new CBadRequestException(ErrorCode.AGENT_IN_USE);
    }
    await this.agentRepo.softDelete(ids);
    return { success: true };
  }
}
