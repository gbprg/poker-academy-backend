import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Header('Cache-Control', 'private, no-store')
  overview(@Request() request: AuthenticatedRequest) {
    return this.analytics.overview(request.user.id);
  }
}
