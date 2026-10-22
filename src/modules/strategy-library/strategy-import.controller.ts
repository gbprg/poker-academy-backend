import { Body, Controller, Header, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ImportPreviewDto } from './import-manifest.dto.js';
import { StrategyImportService } from './strategy-import.service.js';

@ApiTags('admin-imports')
@ApiBearerAuth()
@Controller('admin/imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StrategyImportController {
  constructor(private readonly imports: StrategyImportService) {}

  @Post('preview')
  @Header('Cache-Control', 'private, no-store')
  preview(@Body() input: ImportPreviewDto) {
    return this.imports.preview(input.sourceId, input.bundle);
  }

  @Post('commit')
  @Header('Cache-Control', 'private, no-store')
  commit(@Body() input: ImportPreviewDto) {
    return this.imports.commit(input.sourceId, input.bundle);
  }
}
