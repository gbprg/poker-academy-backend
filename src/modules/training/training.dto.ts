import { IsOptional, IsString } from 'class-validator';

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
