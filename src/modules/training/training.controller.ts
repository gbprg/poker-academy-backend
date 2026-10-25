import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { EligibleCountDto } from './dto/eligible-count.dto.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { TrainingService } from './training.service.js';

@ApiTags('training')
@ApiBearerAuth()
@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Post('sessions')
  @Header('Cache-Control', 'private, no-store')
  createSession(@Request() request: AuthenticatedRequest, @Body() dto: CreateSessionDto) {
    return this.training.createSession(request.user.id, dto);
  }

  @Get('sessions/:sessionId')
  @Header('Cache-Control', 'private, no-store')
  getSession(@Request() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.training.getSession(request.user.id, sessionId);
  }

  @Get('sessions/:sessionId/questions/:position')
  @Header('Cache-Control', 'private, no-store')
  getQuestion(
    @Request() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('position', ParseIntPipe) position: number,
  ) {
    return this.training.getQuestion(request.user.id, sessionId, position);
  }

  @Post('sessions/:sessionId/questions/:position/answers')
  @Header('Cache-Control', 'private, no-store')
  submitAnswer(
    @Request() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('position', ParseIntPipe) position: number,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.training.submitAnswer(request.user.id, sessionId, position, dto);
  }

  @Post('sessions/:sessionId/complete')
  @Header('Cache-Control', 'private, no-store')
  complete(@Request() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.training.completeSession(request.user.id, sessionId);
  }

  @Get('history')
  @Header('Cache-Control', 'private, no-store')
  history(@Request() request: AuthenticatedRequest) {
    return this.training.history(request.user.id);
  }

  @Post('eligible-count')
  @Header('Cache-Control', 'private, no-store')
  eligibleCount(@Request() request: AuthenticatedRequest, @Body() dto: EligibleCountDto) {
    return this.training.eligibleCount(request.user.id, dto);
  }

  @Post('quick')
  @Header('Cache-Control', 'private, no-store')
  quick(@Request() request: AuthenticatedRequest) {
    return this.training.startQuick(request.user.id);
  }
}
