import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const COVERAGE_STATUSES = [
  'DRAFT',
  'REVIEW',
  'PUBLISHED',
  'DEPRECATED',
  'BLOCKED_RIGHTS',
  'UNAVAILABLE',
  'EXPERIMENTAL',
] as const;

export type CoverageStatusValue = (typeof COVERAGE_STATUSES)[number];

export class CoverageQueryDto {
  @IsIn(['MTT', 'SNG'])
  format!: 'MTT' | 'SNG';

  @IsIn(['CHIP_EV', 'ICM', 'PKO', 'EDITORIAL'])
  valuation!: 'CHIP_EV' | 'ICM' | 'PKO' | 'EDITORIAL';

  @IsIn(['PREFLOP', 'FLOP', 'TURN', 'RIVER'])
  street!: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2)
  @Max(10)
  tableSize!: number;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsIn(COVERAGE_STATUSES)
  status?: CoverageStatusValue;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
