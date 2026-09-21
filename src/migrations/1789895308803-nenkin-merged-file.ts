import { MigrationInterface, QueryRunner } from "typeorm";

export class NenkinMergedFile1789895308803 implements MigrationInterface {
    name = 'NenkinMergedFile1789895308803'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`nenkin_procedures\` ADD \`merged_file_url\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`nenkin_procedures\` DROP COLUMN \`merged_file_url\``);
    }

}
