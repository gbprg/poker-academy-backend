import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StrategicSourcesController } from './strategic-sources.controller.js';
import { StrategicSourcesService } from './strategic-sources.service.js';
import { StrategySourceRepository } from './strategy-source.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [StrategicSourcesController],
  providers: [StrategicSourcesService, StrategySourceRepository],
  exports: [StrategicSourcesService],
})
export class StrategyLibraryModule {}
