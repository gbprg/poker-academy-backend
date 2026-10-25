import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReviewAnswerDto {
  @IsString()
  reviewItemId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  quality?: number;
}
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReviewAnswerDto {
  @IsString()
  reviewItemId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  quality?: number;
}
