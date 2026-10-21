import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateLicenseDto, CreateSourceDto } from './source.dto.js';
import { StrategicSourcesService } from './strategic-sources.service.js';

@ApiTags('admin-sources')
@ApiBearerAuth()
@Controller('admin/sources')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StrategicSourcesController {
  constructor(private readonly sources: StrategicSourcesService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() input: CreateSourceDto) {
    return this.sources.createSource(request.user.id, input);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('method') method?: CreateSourceDto['method'],
  ) {
    return this.sources.listSources({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      method,
    });
  }

  @Post(':id/licenses')
  addLicense(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateLicenseDto,
  ) {
    return this.sources.addLicense(request.user.id, id, input);
  }

  @Post(':id/verify-rights')
  verifyRights(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.sources.verifyRights(request.user.id, id);
  }
}
