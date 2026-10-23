import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { gameFormatSchema, streetSchema, tableSizeSchema, valuationModelSchema } from '../strategy/contract/enums.js';

export type GameFormatValue = (typeof gameFormatSchema.options)[number];
export type StreetValue = (typeof streetSchema.options)[number];
export type ValuationValue = (typeof valuationModelSchema.options)[number];
export type TableSizeValue = (typeof tableSizeSchema.options)[number];

export class PreflopRangeQueryDto {
  @IsEnum(gameFormatSchema.options)
  format!: GameFormatValue;

  @IsEnum(valuationModelSchema.options)
  valuation!: ValuationValue;

  @IsEnum(streetSchema.options)
  street!: StreetValue;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2)
  @Max(10)
  tableSize!: TableSizeValue;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  vsPosition?: string;

  @IsOptional()
  @IsString()
  scenario?: string;
}
