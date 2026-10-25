import { Body, Controller, Get, Header, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ProfileService } from './profile.service.js';
import { UpdateProfileDto } from './profile.dto.js';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(@Request() request: AuthenticatedRequest) {
    return this.profile.get(request.user.id);
  }

  @Put()
  @Header('Cache-Control', 'private, no-store')
  update(@Request() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.profile.update(request.user.id, dto);
  }
}
