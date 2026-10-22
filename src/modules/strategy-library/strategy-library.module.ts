import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StrategicSourcesController } from './strategic-sources.controller.js';
import { StrategicSourcesService } from './strategic-sources.service.js';
import { StrategyCatalogImporter } from './strategy-catalog.importer.js';
import { StrategySourceRepository } from './strategy-source.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [StrategicSourcesController],
  providers: [StrategicSourcesService, StrategySourceRepository, StrategyCatalogImporter],
  exports: [StrategicSourcesService, StrategyCatalogImporter],
})
export class StrategyLibraryModule {}
