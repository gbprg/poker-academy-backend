import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PasswordService } from '../auth/password.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { publicUserSelect } from './identity.repository.js';

type BootstrapInput = { name: string; email: string; password: string };

@Injectable()
export class BootstrapAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  async run(input: BootstrapInput) {
    const email = input.email.trim().toLocaleLowerCase('en-US');
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: publicUserSelect,
    });

    if (existing) {
      if (existing.role !== 'ADMIN' || existing.status !== 'ACTIVE') {
        throw new ConflictException(
          'Bootstrap email belongs to a non-active administrator',
        );
      }
      return existing;
    }

    if (input.password.length < 12) {
      throw new RangeError('Bootstrap password must have at least 12 characters');
    }

    const passwordHash = await this.passwords.hash(input.password);

    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash,
          passwordChangedAt: new Date(),
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: publicUserSelect,
      });
      await transaction.auditLog.create({
        data: {
          action: 'ADMIN_BOOTSTRAPPED',
          targetUserId: user.id,
          metadata: { method: 'cli' },
        },
      });
      return user;
    });
  }
}
