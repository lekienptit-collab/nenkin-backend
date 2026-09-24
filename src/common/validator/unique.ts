import { Injectable } from '@nestjs/common';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
} from 'class-validator';
import { ObjectLiteral } from 'typeorm';
import { AbstractUniqueValidator } from './abstract-unique-validator';

@ValidatorConstraint({ name: 'IsUnique', async: true })
@Injectable()
export class IsUnique extends AbstractUniqueValidator {}

export function Unique<E>(
  entity: new (...args: any[]) => E,
  findCondition?: (e: E) => ObjectLiteral,
  idField?: string,
  validationOptions?: ValidationOptions,
) {
  return (object: any, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: {
        message: (args: ValidationArguments) =>
          `${args.property} already exists`,
        ...validationOptions,
      },
      constraints: [entity, findCondition, idField],
      validator: IsUnique,
    });
  };
}
