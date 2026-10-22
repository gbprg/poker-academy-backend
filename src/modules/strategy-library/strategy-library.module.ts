import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StrategicSourcesController } from './strategic-sources.controller.js';
import { StrategicSourcesService } from './strategic-sources.service.js';
import { StrategyCatalogImporter } from './strategy-catalog.importer.js';
import { StrategyLifecycleController } from './strategy-lifecycle.controller.js';
import { StrategyLifecycleService } from './strategy-lifecycle.service.js';
import { StrategySourceRepository } from './strategy-source.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [StrategicSourcesController, StrategyLifecycleController],
  providers: [
    StrategicSourcesService,
    StrategySourceRepository,
    StrategyCatalogImporter,
    StrategyLifecycleService,
  ],
  exports: [StrategicSourcesService, StrategyCatalogImporter, StrategyLifecycleService],
})
export class StrategyLibraryModule {}
