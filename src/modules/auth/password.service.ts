import { Injectable } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';

const passwordHashOptions = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  private readonly dummyHash = hash('dummy-password-never-used-for-login', passwordHashOptions);

  hash(password: string): Promise<string> {
    return hash(password, passwordHashOptions);
  }

  verify(passwordHash: string, candidate: string): Promise<boolean> {
    return verify(passwordHash, candidate);
  }

  async verifyOrDummy(
    passwordHash: string | null,
    candidate: string,
  ): Promise<boolean> {
    return verify(passwordHash ?? (await this.dummyHash), candidate);
  }
}
