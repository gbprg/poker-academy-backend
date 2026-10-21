import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RATE_LIMITS, credentialScopedTracker } from '../../common/throttling.js';
import { ActivateAccountDto, LoginDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('activate')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @Throttle({
    default: { limit: RATE_LIMITS.authAttempts, ttl: RATE_LIMITS.ttlMs },
  })
  activate(@Body() input: ActivateAccountDto) {
    return this.auth.activate(input.token, input.password);
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @Throttle({
    default: {
      limit: RATE_LIMITS.authAttempts,
      ttl: RATE_LIMITS.ttlMs,
      getTracker: credentialScopedTracker,
    },
  })
  login(@Body() input: LoginDto, @Req() request: Request) {
    return this.auth.login(input.email, input.password, request.headers['user-agent']);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user.id);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.auth.logout(request.user.id, request.auth.jti);
  }
}
