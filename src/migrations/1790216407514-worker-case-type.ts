import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkerCaseType1790216407514 implements MigrationInterface {
  name = 'WorkerCaseType1790216407514';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`worker_insurance_histories\` ADD \`pension_scheme\` tinyint NOT NULL DEFAULT '2'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`workers\` ADD \`insurance_loss_image\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nenkin_procedures\` ADD \`case_type\` tinyint NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`nenkin_procedures\` DROP COLUMN \`case_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`workers\` DROP COLUMN \`insurance_loss_image\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`worker_insurance_histories\` DROP COLUMN \`pension_scheme\``,
    );
  }
}
