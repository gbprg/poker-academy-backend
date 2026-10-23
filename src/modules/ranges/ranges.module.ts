import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RangesController } from './ranges.controller.js';
import { RangesRepository } from './ranges.repository.js';
import { RangesService } from './ranges.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RangesController],
  providers: [RangesService, RangesRepository],
  exports: [RangesService],
})
export class RangesModule {}
