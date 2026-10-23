import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SituationsService } from './situations.service.js';

@ApiTags('situations')
@ApiBearerAuth()
@Controller('situations')
@UseGuards(JwtAuthGuard)
export class SituationsController {
  constructor(private readonly situations: SituationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list() {
    return this.situations.list();
  }
}
