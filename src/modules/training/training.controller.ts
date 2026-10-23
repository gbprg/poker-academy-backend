import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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

  @Get('sessions/:sessionId')
  @Header('Cache-Control', 'private, no-store')
  getSession(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.training.getSession(request.user.id, sessionId);
  }

  @Get('sessions/:sessionId/questions/:position')
  @Header('Cache-Control', 'private, no-store')
  getQuestion(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('position', ParseIntPipe) position: number,
  ) {
    return this.training.getQuestion(request.user.id, sessionId, position);
  }
}
