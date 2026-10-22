import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RangesService } from './ranges.service.js';
import { PreflopRangeQueryDto } from './ranges.dto.js';

@ApiTags('ranges')
@ApiBearerAuth()
@Controller('ranges')
@UseGuards(JwtAuthGuard)
export class RangesController {
  constructor(private readonly ranges: RangesService) {}

  @Get('preflop')
  @Header('Cache-Control', 'private, no-store')
  getPreflop(@Query() query: PreflopRangeQueryDto) {
    return this.ranges.getPreflopRange(query);
  }
}
