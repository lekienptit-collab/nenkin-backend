import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkerBankAccountType1790236000000 implements MigrationInterface {
  name = 'WorkerBankAccountType1790236000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`workers\` ADD \`bank_account_type\` tinyint NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`workers\` DROP COLUMN \`bank_account_type\``,
    );
  }
}
