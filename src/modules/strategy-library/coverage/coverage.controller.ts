import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { CoverageQueryDto } from './coverage.dto.js';
import { CoverageService } from './coverage.service.js';

@ApiTags('coverage')
@ApiBearerAuth()
@Controller('coverage')
@UseGuards(JwtAuthGuard)
export class CoverageController {
  constructor(private readonly coverage: CoverageService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  query(@Req() request: AuthenticatedRequest, @Query() query: CoverageQueryDto) {
    return this.coverage.query(query, request.user);
  }
}
