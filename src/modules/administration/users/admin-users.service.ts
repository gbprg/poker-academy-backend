import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { publicUserSelect } from '../../identity/identity.repository.js';

type InviteUserInput = {
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  expiresInHours: number;
};

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
  ) {}

  async invite(actorUserId: string, input: InviteUserInput) {
    const activationToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256')
      .update(activationToken, 'utf8')
      .digest('hex');
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
        data: {
          name: input.name.trim(),
          email: input.email.trim().toLocaleLowerCase('en-US'),
          role: input.role,
          status: 'INVITED',
        },
        select: publicUserSelect,
      });
        await transaction.accountActivation.create({
          data: { userId: user.id, tokenHash, expiresAt },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId,
            targetUserId: user.id,
            action: 'USER_INVITED',
            metadata: { role: input.role, expiresAt: expiresAt.toISOString() },
          },
        });

        return { user, activationToken, expiresAt };
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Account already exists');
      }
      throw error;
    }
  }
}
