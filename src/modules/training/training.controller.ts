import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TrainingService } from './training.service.js';
import { CreateTrainingSessionDto } from './training.dto.js';

@ApiTags('training')
@ApiBearerAuth()
@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Post('sessions')
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateTrainingSessionDto) {
    return this.training.createSession(request.user.id, dto);
  }
}
