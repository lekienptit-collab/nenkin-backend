import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NenkinProcedureEntity } from './nenkin-procedure.entity';

/** Trạng thái sinh file của một giấy tờ. */
export enum NenkinDocumentStatus {
  /** Đã ghi nhận nhưng chưa có file PDF (chưa cấu hình mẫu). */
  PENDING = 'PENDING',
  /** Đã sinh xong file PDF. */
  GENERATED = 'GENERATED',
}

/**
 * Một giấy tờ thuộc bộ hồ sơ của 1 lần thủ tục Nenkin.
 * fileUrl chỉ có khi mẫu PDF tương ứng đã được cấu hình.
 */
@Entity('nenkin_documents')
export class NenkinDocumentEntity {
  @PrimaryGeneratedColumn('increment')
  @ApiProperty()
  id?: number;

  @Column({ name: 'procedure_id' })
  @ApiProperty()
  procedureId?: number;

  @ManyToOne(() => NenkinProcedureEntity, (p) => p.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'procedure_id' })
  procedure?: NenkinProcedureEntity;

  /** Mã mẫu giấy tờ, khớp với NENKIN_PAPER_TEMPLATES. */
  @Column()
  @ApiProperty()
  code: string;

  @Column()
  @ApiProperty()
  name: string;

  @Column({ name: 'file_url', nullable: true })
  @ApiProperty()
  fileUrl?: string;

  @Column({ type: 'varchar', default: NenkinDocumentStatus.PENDING })
  @ApiProperty({ enum: NenkinDocumentStatus })
  status?: NenkinDocumentStatus;

  @Column({ name: 'sort_order', default: 0 })
  @ApiProperty()
  sortOrder?: number;

  @CreateDateColumn({ name: 'create_at' })
  createAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;
}
