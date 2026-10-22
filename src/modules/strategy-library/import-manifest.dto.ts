import { IsString, IsUUID, MinLength } from 'class-validator';

export class ImportPreviewDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @MinLength(1)
  bundle!: string;
}
