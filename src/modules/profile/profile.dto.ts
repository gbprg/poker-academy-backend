import { IsObject, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
