import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NenkinServiceType } from 'src/common/constatns/master-data';
import { AgentEntity } from './agent.entity';
import { NenkinDocumentEntity } from './nenkin-document.entity';
import { UserEntity } from './user.entity';
import { WorkerEntity } from './worker.entity';

/**
 * Một lần làm thủ tục Nenkin cho 1 người lao động.
 * Mỗi người lao động chỉ có tối đa 1 bản ghi cho mỗi serviceType;
 * làm lại lần nữa là cập nhật bản ghi cũ và sinh lại giấy tờ.
 */
@Entity('nenkin_procedures')
@Index('IDX_nenkin_procedure_worker_type', ['workerId', 'serviceType'], {
  unique: true,
})
export class NenkinProcedureEntity {
  @PrimaryGeneratedColumn('increment')
  @ApiProperty()
  id?: number;

  @Column({ name: 'worker_id' })
  @ApiProperty()
  workerId: number;

  @ManyToOne(() => WorkerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_id' })
  worker?: WorkerEntity;

  @Column({ name: 'agent_id', nullable: true })
  @ApiProperty()
  agentId?: number;

  @ManyToOne(() => AgentEntity, { nullable: true })
  @JoinColumn({ name: 'agent_id' })
  agent?: AgentEntity;

  @Column({ name: 'service_type', type: 'tinyint' })
  @ApiProperty({ enum: NenkinServiceType })
  serviceType: NenkinServiceType;

  /** Quan hệ với người được uỷ quyền (納税管理人, 友達 hoặc tự nhập). */
  @Column({ nullable: true })
  @ApiProperty()
  relation?: string;

  // ----- Thủ tục lần 1 -----
  @Column({ name: 'request_date', type: 'date', nullable: true })
  @ApiProperty()
  requestDate?: string;

  @Column({ name: 'entrust_date', type: 'date', nullable: true })
  @ApiProperty()
  entrustDate?: string;

  // ----- Thủ tục lần 2 -----
  @Column({ name: 'tax_request_date', type: 'date', nullable: true })
  @ApiProperty()
  taxRequestDate?: string;

  @Column({ name: 'tax_entrust_date', type: 'date', nullable: true })
  @ApiProperty()
  taxEntrustDate?: string;

  /** Văn phòng thuế (税務署) tiếp nhận tờ khai. */
  @Column({ name: 'tax_office', nullable: true })
  @ApiProperty()
  taxOffice?: string;

  @OneToMany(() => NenkinDocumentEntity, (d) => d.procedure, { cascade: true })
  documents?: NenkinDocumentEntity[];

  /** File PDF gộp cả bộ giấy tờ, dùng để xem trước và in một lượt. */
  @Column({ name: 'merged_file_url', nullable: true })
  @ApiProperty()
  mergedFileUrl?: string;

  @Column({ name: 'created_by', nullable: true })
  @ApiProperty()
  createdById?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: UserEntity;

  @CreateDateColumn({ name: 'create_at' })
  createAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
