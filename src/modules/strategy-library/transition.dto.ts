import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { LIFECYCLE_STATUSES, type LifecycleStatus } from './lifecycle.js';

export class TransitionDto {
  @IsIn(LIFECYCLE_STATUSES)
  to!: LifecycleStatus;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  justification?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  reviewerNote?: string;
}
