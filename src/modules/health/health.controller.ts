import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service.js';

export type HealthResponse = {
  status: 'ok';
  database: 'up';
};

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', database: 'up' },
    },
  })
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
