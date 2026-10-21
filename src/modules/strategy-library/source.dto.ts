import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;

export class CreateSourceDto {
  @IsString()
  @Length(2, 120)
  @Matches(SLUG, { message: 'slug must be lower-kebab-case' })
  slug!: string;

  @IsString()
  @Length(2, 200)
  title!: string;

  @IsString()
  @Length(2, 200)
  author!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  originUrl?: string;

  @IsIn(['SOLVER_VERIFIED', 'LICENSED', 'EDITORIAL', 'DEMO_NOT_GTO'])
  method!: 'SOLVER_VERIFIED' | 'LICENSED' | 'EDITORIAL' | 'DEMO_NOT_GTO';
}

export class CreateLicenseDto {
  @IsString()
  @Length(1, 160)
  licenseName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  licenseUrl?: string;

  @IsString()
  @Length(1, 5000)
  terms!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  authorizationId?: string;

  @IsString()
  @Matches(SHA256, { message: 'checksum must be a sha256 hex string' })
  checksum!: string;
}

export class AdvanceStatusDto {
  @IsIn(['REVIEW', 'PUBLISHED', 'DEPRECATED', 'BLOCKED_RIGHTS', 'UNAVAILABLE'])
  status!: 'REVIEW' | 'PUBLISHED' | 'DEPRECATED' | 'BLOCKED_RIGHTS' | 'UNAVAILABLE';
}
