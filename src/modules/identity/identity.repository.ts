import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type IdentityDatabase = Pick<
  PrismaClient,
  'user' | 'accountActivation' | 'authSession'
>;

type CreateInvitedUserInput = {
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
};

type CreateActivationInput = {
  userId: string;
  rawToken: string;
  expiresAt: Date;
};

type CreateSessionInput = {
  userId: string;
  jti: string;
  issuedAt: Date;
  expiresAt: Date;
  userAgentHash?: string;
};

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  passwordChangedAt: true,
  createdAt: true,
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

@Injectable()
export class IdentityRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: IdentityDatabase,
  ) {}

  createInvitedUser(input: CreateInvitedUserInput) {
    return this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        role: input.role,
        status: 'INVITED',
      },
      select: publicUserSelect,
    });
  }

  async createActivation(input: CreateActivationInput) {
    if (input.expiresAt.getTime() <= Date.now()) {
      throw new RangeError('Activation expiry must be in the future');
    }

    return this.prisma.accountActivation.create({
      data: {
        userId: input.userId,
        tokenHash: hashSecret(input.rawToken),
        expiresAt: input.expiresAt,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        consumedAt: true,
        createdAt: true,
      },
    });
  }

  createSession(input: CreateSessionInput) {
    return this.prisma.authSession.create({
      data: input,
      select: {
        id: true,
        jti: true,
        userId: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  findLiveSession(jti: string, now = new Date()) {
    return this.prisma.authSession.findFirst({
      where: {
        jti,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        jti: true,
        userId: true,
        issuedAt: true,
        expiresAt: true,
      },
    });
  }
}
