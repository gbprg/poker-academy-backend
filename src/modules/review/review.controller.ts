import { Body, Controller, Get, Header, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReviewService } from './review.service.js';
import { ReviewAnswerDto } from './review.dto.js';

@ApiTags('review')
@ApiBearerAuth()
@Controller('review')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get('due')
  @Header('Cache-Control', 'private, no-store')
  getDue(@Request() request: AuthenticatedRequest) {
    return this.review.getDue(request.user.id);
  }

  @Post('answer')
  @Header('Cache-Control', 'private, no-store')
  answer(@Request() request: AuthenticatedRequest, @Body() dto: ReviewAnswerDto) {
    return this.review.answer(request.user.id, dto);
  }
}
