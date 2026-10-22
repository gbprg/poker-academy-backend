import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { StrategyLifecycleService } from './strategy-lifecycle.service.js';
import { TransitionDto } from './transition.dto.js';

@ApiTags('admin-strategy-lifecycle')
@ApiBearerAuth()
@Controller('admin/strategy-versions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StrategyLifecycleController {
  constructor(private readonly lifecycle: StrategyLifecycleService) {}

  @Post(':id/transition')
  transition(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionDto,
  ) {
    return this.lifecycle.transition(request.user.id, id, body);
  }
}
