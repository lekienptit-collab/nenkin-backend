import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkerEntity } from './worker.entity';

/**
 * Một dòng trong bảng "Quá trình tham gia chế độ lương hưu chung".
 * Mẫu đơn chỉ in được tối đa MAX_INSURANCE_HISTORY dòng.
 */
@Entity('worker_insurance_histories')
export class WorkerInsuranceHistoryEntity {
  @PrimaryGeneratedColumn('increment')
  @ApiProperty()
  id?: number;

  @Column({ name: 'worker_id' })
  @ApiProperty()
  workerId?: number;

  @ManyToOne(() => WorkerEntity, (w) => w.insuranceHistories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'worker_id' })
  worker?: WorkerEntity;

  /** Tên cơ sở kinh doanh. Nếu là thuyền viên thì ghi chủ tàu + tên tàu. */
  @Column({ name: 'work_place', type: 'text', nullable: true })
  @ApiProperty()
  workPlace?: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty()
  address?: string;

  @Column({ name: 'from_date', type: 'date', nullable: true })
  @ApiProperty()
  fromDate?: string;

  @Column({ name: 'to_date', type: 'date', nullable: true })
  @ApiProperty()
  toDate?: string;

  @Column({ name: 'sort_order', default: 0 })
  @ApiProperty()
  sortOrder?: number;
}

/** Số dòng lịch sử tối đa (form gốc cho thêm 3 dòng sau dòng đầu). */
export const MAX_INSURANCE_HISTORY = 4;
