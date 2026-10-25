import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TrainingService } from './training.service.js';
import { EligibleCountDto } from './training.dto.js';

@ApiTags('training')
@ApiBearerAuth()
@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Post('eligible-count')
  @Header('Cache-Control', 'private, no-store')
  eligible(@Req() _request: AuthenticatedRequest, @Body() dto: EligibleCountDto) {
    return this.training.eligibleCount(dto);
  }
}
