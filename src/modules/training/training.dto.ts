import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateTrainingSessionDto {
  @IsOptional()
  @IsString()
  spotId?: string;

  @IsOptional()
  @IsString()
  strategyVersionId?: string;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  scenario?: Record<string, unknown>;
}

export class SubmitTrainingAnswerDto {
  @IsString()
  @Length(1, 20)
  actionType!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sizing?: number;

  @IsString()
  @Length(8, 120)
  idempotencyKey!: string;
}

export class EligibleCountDto {
  @IsOptional()
  @IsString()
  spotId?: string;

  @IsOptional()
  @IsString()
  strategyVersionId?: string;

  @IsOptional()
  filters?: Record<string, unknown>;
}

export class CreateTrainingPresetDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  filters!: Record<string, unknown>;

  @IsOptional()
  scenario?: Record<string, unknown>;
}

export class UpdateTrainingPresetDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  scenario?: Record<string, unknown>;
}
