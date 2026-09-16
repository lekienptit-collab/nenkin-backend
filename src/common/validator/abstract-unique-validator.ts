import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, Not, ObjectLiteral } from 'typeorm';

export type UniqueValidationArguments<E> = ValidationArguments & {
  constraints: [
    new (...args: any[]) => E,
    ((e: E) => ObjectLiteral) | undefined,
    string | undefined,
  ];
};

/**
 * Kiểm tra giá trị chưa tồn tại trong DB. Có thể bỏ qua chính bản ghi đang sửa
 * bằng cách truyền tên field id ở constraint thứ 3.
 */
@Injectable()
export abstract class AbstractUniqueValidator
  implements ValidatorConstraintInterface
{
  constructor(@InjectDataSource() protected readonly dataSource: DataSource) {}

  public async validate<E>(
    value: string,
    args: UniqueValidationArguments<E>,
  ): Promise<boolean> {
    const [entityClass, findCondition, idField] = args.constraints;
    const where: ObjectLiteral = findCondition
      ? findCondition(args.object as E)
      : { [args.property]: value };

    const currentId = idField ? (args.object as any)?.[idField] : undefined;
    if (currentId) {
      where['id'] = Not(currentId);
    }

    const count = await this.dataSource
      .getRepository(entityClass)
      .count({ where: where as any });
    return count === 0;
  }

  public defaultMessage(args: ValidationArguments): string {
    return `${args.property} already exists`;
  }
}
