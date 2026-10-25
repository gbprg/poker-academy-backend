import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TrainingService } from './training.service.js';
import {
  CreateTrainingPresetDto,
  CreateTrainingSessionDto,
  EligibleCountDto,
  SubmitTrainingAnswerDto,
  UpdateTrainingPresetDto,
} from './training.dto.js';

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

  @Post('eligible-count')
  @Header('Cache-Control', 'private, no-store')
  eligible(@Req() request: AuthenticatedRequest, @Body() dto: EligibleCountDto) {
    return this.training.eligibleCount(dto);
  }

  @Get('presets')
  @Header('Cache-Control', 'private, no-store')
  listPresets(@Req() request: AuthenticatedRequest) {
    return this.training.listPresets(request.user.id);
  }

  @Post('presets')
  @Header('Cache-Control', 'private, no-store')
  createPreset(@Req() request: AuthenticatedRequest, @Body() dto: CreateTrainingPresetDto) {
    return this.training.createPreset(request.user.id, dto);
  }

  @Put('presets/:presetId')
  @Header('Cache-Control', 'private, no-store')
  updatePreset(
    @Req() request: AuthenticatedRequest,
    @Param('presetId') presetId: string,
    @Body() dto: UpdateTrainingPresetDto,
  ) {
    return this.training.updatePreset(request.user.id, presetId, dto);
  }

  @Delete('presets/:presetId')
  @Header('Cache-Control', 'private, no-store')
  deletePreset(@Req() request: AuthenticatedRequest, @Param('presetId') presetId: string) {
    return this.training.deletePreset(request.user.id, presetId);
  }

  @Get('sessions/:sessionId')
  @Header('Cache-Control', 'private, no-store')
  getSession(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.training.getSession(request.user.id, sessionId);
  }

  @Post('sessions/:sessionId/complete')
  @Header('Cache-Control', 'private, no-store')
  complete(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.training.completeSession(request.user.id, sessionId);
  }

  @Get('history')
  @Header('Cache-Control', 'private, no-store')
  getHistory(@Req() request: AuthenticatedRequest) {
    return this.training.getHistory(request.user.id);
  }

  @Post('sessions/:sessionId/questions/:position/answers')
  @Header('Cache-Control', 'private, no-store')
  submitAnswer(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('position', ParseIntPipe) position: number,
    @Body() dto: SubmitTrainingAnswerDto,
  ) {
    return this.training.submitAnswer(request.user.id, sessionId, position, dto);
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
