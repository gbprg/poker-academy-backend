import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccessTokenService } from './access-token.service.js';
import type { AuthenticatedUser } from './auth.types.js';

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
  auth: { jti: string };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: AccessTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer ([^\s]+)$/);
    if (!match) throw new UnauthorizedException('Invalid authentication');

    const payload = await this.tokens.verify(match[1]);
    const session = await this.prisma.authSession.findFirst({
      where: {
        jti: payload.jti,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE' },
      },
      select: {
        jti: true,
        user: { select: { id: true, role: true, status: true } },
      },
    });
    if (!session || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid authentication');
    }

    request.user = { ...session.user, status: 'ACTIVE' };
    request.auth = { jti: session.jti };
    return true;
  }
}
