import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from './auth.types.js';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async verify(token: string): Promise<AccessTokenPayload> {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new UnauthorizedException('Invalid authentication');
    }

    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret,
        algorithms: ['HS256'],
        issuer: this.config.get<string>('JWT_ISSUER', 'poker-academy-api'),
        audience: this.config.get<string>(
          'JWT_AUDIENCE',
          'poker-academy-frontend',
        ),
      });
      if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
        throw new Error('Missing required claims');
      }
      return { sub: payload.sub, jti: payload.jti };
    } catch {
      throw new UnauthorizedException('Invalid authentication');
    }
  }
}
