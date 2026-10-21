import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ActivateAccountDto {
  @IsString()
  @Length(43, 128)
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
