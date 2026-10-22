import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { CoverageController } from './coverage.controller.js';
import { CoverageRepository } from './coverage.repository.js';
import { CoverageService } from './coverage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CoverageController],
  providers: [CoverageService, CoverageRepository],
})
export class CoverageModule {}
