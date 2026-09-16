import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray } from 'class-validator';

export class IdsDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  ids: number[];
}

export class IdsStringDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  ids: string[];
}
