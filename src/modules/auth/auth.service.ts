import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { publicUserSelect } from '../identity/identity.repository.js';
import { AccessTokenService } from './access-token.service.js';
import { PasswordService } from './password.service.js';

const invalidCredentials = () =>
  new UnauthorizedException('Invalid email or password');
const invalidActivation = () =>
  new BadRequestException('Invalid or expired activation');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: AccessTokenService,
  ) {}

  async activate(rawToken: string, password: string) {
    const tokenHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
    const passwordHash = await this.passwords.hash(password);
    const now = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const activation = await transaction.accountActivation.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          consumedAt: true,
          user: { select: { status: true } },
        },
      });
      if (
        !activation ||
        activation.consumedAt ||
        activation.expiresAt <= now ||
        activation.user.status !== 'INVITED'
      ) {
        throw invalidActivation();
      }

      const consumed = await transaction.accountActivation.updateMany({
        where: {
          id: activation.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      const activated = await transaction.user.updateMany({
        where: { id: activation.userId, status: 'INVITED' },
        data: { status: 'ACTIVE', passwordHash, passwordChangedAt: now },
      });
      if (consumed.count !== 1 || activated.count !== 1) {
        throw invalidActivation();
      }

      await transaction.auditLog.create({
        data: {
          targetUserId: activation.userId,
          action: 'ACCOUNT_ACTIVATED',
          metadata: { activationId: activation.id },
        },
      });
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: activation.userId },
        select: publicUserSelect,
      });
      return { user };
    });
  }

  async login(emailInput: string, password: string, userAgent?: string) {
    const email = emailInput.trim().toLocaleLowerCase('en-US');
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...publicUserSelect, passwordHash: true },
    });
    const passwordMatches = await this.passwords.verifyOrDummy(
      user?.passwordHash ?? null,
      password,
    );
    if (!user || !passwordMatches || user.status !== 'ACTIVE' || !user.passwordHash) {
      throw invalidCredentials();
    }

    const jti = randomUUID();
    const issued = await this.tokens.issue(user.id, jti);
    const userAgentHash = userAgent
      ? createHash('sha256').update(userAgent).digest('hex')
      : undefined;
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        jti,
        issuedAt: issued.issuedAt,
        expiresAt: issued.expiresAt,
        userAgentHash,
      },
    });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return {
      accessToken: issued.accessToken,
      expiresAt: issued.expiresAt,
      user: safeUser,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid authentication');
    }
    return { user };
  }

  async logout(userId: string, jti: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
