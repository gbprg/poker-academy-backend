import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

const USER_STATUSES = ['ACTIVE', 'BLOCKED'] as const;
const USER_ROLES = ['ADMIN', 'USER'] as const;

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: 'ADMIN' | 'USER';

  @IsOptional()
  @IsEnum(USER_STATUSES)
  status?: 'ACTIVE' | 'BLOCKED';
}

export class ResetAccessDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours = 24;
}
