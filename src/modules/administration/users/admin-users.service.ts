import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { publicUserSelect } from '../../identity/identity.repository.js';

type InviteUserInput = {
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  expiresInHours: number;
};

type UpdateUserInput = {
  name?: string;
  role?: 'ADMIN' | 'USER';
  status?: 'ACTIVE' | 'BLOCKED';
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

  async list() {
    const users = await this.prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return { users };
  }

  async update(actorUserId: string, targetUserId: string, input: UpdateUserInput) {
    return this.prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, status: true },
      });
      if (!target) throw new NotFoundException('User not found');
      if (!input.name && !input.role && !input.status) {
        throw new BadRequestException('No changes requested');
      }
      if (input.status === 'BLOCKED' && target.id === actorUserId) {
        throw new ConflictException('Cannot block the acting administrator');
      }

      const user = await transaction.user.update({
        where: { id: targetUserId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        select: publicUserSelect,
      });

      if (input.status === 'BLOCKED') {
        await transaction.authSession.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await transaction.auditLog.create({
        data: {
          actorUserId,
          targetUserId,
          action: input.status === 'BLOCKED' ? 'USER_STATUS_CHANGED' : 'USER_UPDATED',
          metadata: {
            ...(input.name !== undefined ? { name: user.name } : {}),
            ...(input.role !== undefined ? { role: user.role } : {}),
            ...(input.status !== undefined ? { status: user.status } : {}),
          },
        },
      });

      return { user };
    });
  }

  async resetAccess(actorUserId: string, targetUserId: string, expiresInHours: number) {
    const activationToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256')
      .update(activationToken, 'utf8')
      .digest('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    return this.prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('User not found');

      const user = await transaction.user.update({
        where: { id: targetUserId },
        data: { status: 'INVITED' },
        select: publicUserSelect,
      });
      await transaction.accountActivation.deleteMany({ where: { userId: targetUserId } });
      await transaction.accountActivation.create({
        data: { userId: targetUserId, tokenHash, expiresAt },
      });
      await transaction.authSession.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          targetUserId,
          action: 'USER_ACCESS_RESET',
          metadata: { expiresAt: expiresAt.toISOString() },
        },
      });

      return { user, activationToken, expiresAt };
    });
  }
}
